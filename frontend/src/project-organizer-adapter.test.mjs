import assert from 'node:assert/strict';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createMemoryOrganizerHarness, runProjectOrganizerAdapterContract } from '@tigao/organizer-contract-tests';
import { createP5ProjectOrganizerAdapter } from './project-organizer-adapter.mjs';

const jsonResponse = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'Content-Type': 'application/json' }
});

function createFakeP5Server({ openCreatedProject = false } = {}) {
  const memoryHarness = createMemoryOrganizerHarness();
  const failures = new Map();
  const calls = [];
  const openedProjects = [];

  const consumeFailure = (method) => {
    const error = failures.get(method);
    if (!error) return;
    failures.delete(method);
    throw error;
  };

  const fetchImpl = async (input, init = {}) => {
    const url = new URL(input, 'http://localhost');
    const method = init.method || 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    const ownerId = url.searchParams.has('studentId') ? Number(url.searchParams.get('studentId')) : null;
    const parentId = url.searchParams.has('parentId') ? Number(url.searchParams.get('parentId')) : null;
    calls.push({ url: `${url.pathname}${url.search}`, method, body, headers: init.headers });

    if (method === 'GET' && (url.pathname === '/api/projects' || url.pathname === '/api/project-groups')) {
      consumeFailure('loadDirectory');
      const directory = await memoryHarness.adapter.loadDirectory({ ownerId, parentId });
      return jsonResponse(url.pathname === '/api/projects' ? directory.projects : {
        groups: directory.groups,
        breadcrumbs: directory.breadcrumbs
      });
    }

    if (method === 'GET' && url.pathname === '/api/project-groups/all') {
      consumeFailure('loadAllGroups');
      return jsonResponse({ groups: await memoryHarness.adapter.loadAllGroups({ ownerId }) });
    }

    if (method === 'POST' && url.pathname === '/api/projects') {
      consumeFailure('createProject');
      const project = await memoryHarness.adapter.createProject(body);
      return jsonResponse({ id: project.id, name: project.name }, 201);
    }

    if (method === 'POST' && url.pathname === '/api/project-groups') {
      consumeFailure('createGroup');
      const group = await memoryHarness.adapter.createGroup(body);
      return jsonResponse({ group: { id: group.id }, message: 'created' }, 201);
    }

    const projectMatch = url.pathname.match(/^\/api\/projects\/([^/]+)(?:\/(reposition))?$/);
    const groupMatch = url.pathname.match(/^\/api\/project-groups\/([^/]+)(?:\/(reposition))?$/);
    const match = projectMatch || groupMatch;
    if (match) {
      const kind = projectMatch ? 'project' : 'group';
      const id = kind === 'project' ? decodeURIComponent(match[1]) : Number(match[1]);

      if (method === 'PUT' && match[2] === 'reposition') {
        consumeFailure('repositionItem');
        await memoryHarness.adapter.repositionItem({ kind, id, parentId: body.parentId, beforeId: body.beforeId });
        return jsonResponse({ message: 'repositioned' });
      }

      if (method === 'PUT') {
        consumeFailure('renameItem');
        await memoryHarness.adapter.renameItem({ kind, id, name: body.name });
        return jsonResponse({ message: 'renamed' });
      }

      if (method === 'DELETE') {
        consumeFailure('deleteItem');
        await memoryHarness.adapter.deleteItem({ kind, id });
        return jsonResponse({ message: 'deleted' });
      }
    }

    return jsonResponse({ message: 'Not found', code: 'NOT_FOUND' }, 404);
  };

  const adapter = createP5ProjectOrganizerAdapter({
    fetchImpl,
    resolveOwner: (ownerId) => ownerId === null
      ? { id: 1, username: 'current-user' }
      : { id: Number(ownerId), username: ownerId === 2 ? 'read-only-user' : `user-${ownerId}` },
    openProject: async (id) => {
      openedProjects.push(id);
      return memoryHarness.adapter.openProject(id);
    },
    openCreatedProject
  });

  return {
    adapter,
    calls,
    controls: {
      failNext(method, error = Object.assign(new Error(`${method} failed.`), { code: 'SIMULATED_FAILURE', status: 503 })) {
        failures.set(method, error);
      },
      setCorruptTree(enabled) {
        memoryHarness.controls.setCorruptTree(enabled);
      }
    },
    getState: memoryHarness.getState,
    getOpenedProjects: () => [...openedProjects]
  };
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('teaching_token', 'adapter-test-token');
});

describe('p5.js organizer adapter shared contract', () => {
  runProjectOrganizerAdapterContract({
    test,
    assert,
    createHarness: () => createFakeP5Server()
  });
});

describe('p5.js organizer adapter API mapping', () => {
  test('uses JWT headers, owner queries, snake_case normalization, and exact reposition routes', async () => {
    const harness = createFakeP5Server();
    const directory = await harness.adapter.loadDirectory({ ownerId: 2, parentId: 20 });

    expect(directory.owner).toEqual({ id: 2, username: 'read-only-user' });
    expect(directory.readOnly).toBe(true);
    expect(directory.projects[0]).toMatchObject({
      kind: 'project',
      id: 'project-read-only',
      parentId: 20,
      sortOrder: 0
    });
    expect(harness.calls[0].headers.Authorization).toBe('Bearer adapter-test-token');
    expect(harness.calls.some((call) => call.url === '/api/projects?studentId=2&parentId=20')).toBe(true);

    await harness.adapter.loadDirectory({ parentId: null });
    await harness.adapter.repositionItem({
      kind: 'project',
      id: 'project-root-a',
      parentId: null,
      beforeId: null
    });
    const reposition = harness.calls.find((call) => call.url === '/api/projects/project-root-a/reposition');
    expect(reposition.method).toBe('PUT');
    expect(reposition.body).toEqual({ parentId: null, beforeId: null });
  });

  test('re-reads authoritative data after create and opens the new editor immediately', async () => {
    const harness = createFakeP5Server({ openCreatedProject: true });
    await harness.adapter.loadDirectory({ parentId: 1 });
    const project = await harness.adapter.createProject({ name: 'New Sketch', parentId: 1, templateId: 'blank' });

    expect(project).toMatchObject({ kind: 'project', name: 'New Sketch', parentId: 1 });
    expect(harness.getOpenedProjects()).toEqual([project.id]);
    expect(harness.calls.slice(-2).map((call) => call.url)).toEqual([
      '/api/projects?parentId=1',
      '/api/project-groups?parentId=1'
    ]);
    expect(harness.calls.find((call) => call.method === 'POST' && call.url === '/api/projects').body).toEqual({
      name: 'New Sketch',
      parentId: 1,
      templateId: 'blank'
    });
  });

  test('preserves server error message, status, and code', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ message: '没有权限', code: 'DENIED' }, 403));
    const handleAuthFailure = vi.fn();
    const adapter = createP5ProjectOrganizerAdapter({ fetchImpl, handleAuthFailure, openCreatedProject: false });

    await expect(adapter.loadDirectory({ ownerId: 9 })).rejects.toMatchObject({
      message: '没有权限',
      status: 403,
      code: 'DENIED'
    });
    expect(handleAuthFailure).toHaveBeenCalled();
  });
});
