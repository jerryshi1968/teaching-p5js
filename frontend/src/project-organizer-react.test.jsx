import React, { useState } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { ProjectOrganizer } from '@tigao/organizer-react';
import { createMemoryOrganizerHarness } from '@tigao/organizer-contract-tests';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const projectOrder = () => Array.from(document.querySelectorAll('.tigao-organizer__card--project strong')).map((node) => node.textContent);

const renderOrganizer = ({ harness = createMemoryOrganizerHarness(), ...props } = {}) => {
  const result = render(
    <ProjectOrganizer
      adapter={harness.adapter}
      messages={{ title: 'Projects', root: 'Root group' }}
      {...props}
    />
  );
  return { harness, ...result };
};

const mockOrganizerRects = () => vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function getBoundingClientRect() {
  const breadcrumb = this.matches?.('.tigao-organizer__breadcrumb') ? this : this.closest?.('.tigao-organizer__breadcrumb');
  if (breadcrumb) {
    const breadcrumbs = Array.from(document.querySelectorAll('.tigao-organizer__breadcrumb'));
    const index = breadcrumbs.indexOf(breadcrumb);
    const left = 20 + index * 130;
    return { x: left, y: 20, left, top: 20, right: left + 110, bottom: 60, width: 110, height: 40, toJSON: () => ({}) };
  }

  const card = this.matches?.('.tigao-organizer__card') ? this : this.closest?.('.tigao-organizer__card');
  if (card?.classList.contains('tigao-organizer__card--group')) {
    const groups = Array.from(document.querySelectorAll('.tigao-organizer__card--group'));
    const index = groups.indexOf(card);
    const left = 20 + index * 280;
    return { x: left, y: 100, left, top: 100, right: left + 250, bottom: 276, width: 250, height: 176, toJSON: () => ({}) };
  }

  const projectCards = Array.from(document.querySelectorAll('.tigao-organizer__card--project'));
  const index = card ? projectCards.indexOf(card) : -1;
  const left = index >= 0 ? 320 + index * 280 : 0;
  const top = index >= 0 ? 320 : 0;
  return { x: left, y: top, left, top, right: left + 250, bottom: top + 176, width: 250, height: 176, toJSON: () => ({}) };
});

const mouseDrag = async (handle, from, to) => {
  fireEvent.mouseDown(handle, { button: 0, buttons: 1, clientX: from.x, clientY: from.y });
  fireEvent.mouseMove(document, { buttons: 1, clientX: from.x + 10, clientY: from.y + 10 });
  await waitFor(() => expect(document.querySelector('.tigao-organizer__drag-overlay')).toBeTruthy());
  fireEvent.mouseMove(document, { buttons: 1, clientX: to.x, clientY: to.y });
  fireEvent.mouseUp(document, { button: 0, buttons: 0, clientX: to.x, clientY: to.y });
};

describe('installed ProjectOrganizer integration', () => {
  test('loads the root directory and a deep breadcrumb path', async () => {
    const { harness, rerender } = renderOrganizer();
    expect(await screen.findByText('First Project')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Root group' }).getAttribute('aria-current')).toBe('page');

    rerender(
      <ProjectOrganizer
        adapter={harness.adapter}
        currentParentId={3}
        messages={{ title: 'Projects', root: 'Root group' }}
      />
    );

    expect(await screen.findByText('Deep Project')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Lessons' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Week One' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Exercises' }).getAttribute('aria-current')).toBe('page');
  });

  test('creates a group and a project through the installed create forms', async () => {
    const user = userEvent.setup();
    renderOrganizer();
    await screen.findByText('First Project');

    await user.type(screen.getByLabelText('Group name'), 'New Group');
    await user.click(screen.getByRole('button', { name: 'Create group' }));
    expect(await screen.findByText('New Group')).toBeTruthy();

    await user.type(screen.getByLabelText('Project name'), 'New Project');
    await user.click(screen.getByRole('button', { name: 'Create project' }));
    expect(await screen.findByText('New Project')).toBeTruthy();
  });

  test('renames and deletes items with the shared dialogs', async () => {
    const user = userEvent.setup();
    renderOrganizer();
    await screen.findByText('First Project');

    await user.click(screen.getByRole('button', { name: 'Rename: First Project' }));
    const renameDialog = screen.getByRole('dialog');
    const renameInput = within(renameDialog).getByLabelText('Rename');
    await user.clear(renameInput);
    await user.type(renameInput, 'Renamed Project');
    await user.click(within(renameDialog).getByRole('button', { name: 'Confirm' }));
    expect(await screen.findByText('Renamed Project')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Delete: Second Project' }));
    const deleteDialog = screen.getByRole('dialog');
    await user.click(within(deleteDialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.queryByText('Second Project')).toBeNull());
  });

  test('moves up, moves down, and appends with beforeId null', async () => {
    const user = userEvent.setup();
    const { harness } = renderOrganizer();
    await screen.findByText('First Project');

    await user.click(screen.getByRole('button', { name: 'Move down: First Project' }));
    await waitFor(() => expect(projectOrder().slice(0, 2)).toEqual(['Second Project', 'First Project']));
    await user.click(screen.getByRole('button', { name: 'Move up: First Project' }));
    await waitFor(() => expect(projectOrder().slice(0, 2)).toEqual(['First Project', 'Second Project']));

    await harness.adapter.repositionItem({ kind: 'project', id: 'project-root-a', parentId: 1, beforeId: null });
    const lessons = await harness.adapter.loadDirectory({ parentId: 1 });
    expect(lessons.projects.at(-1).id).toBe('project-root-a');
  });

  test('moves a project across groups through the shared destination dialog', async () => {
    const user = userEvent.setup();
    const { harness } = renderOrganizer();
    await screen.findByText('First Project');

    await user.click(screen.getByRole('button', { name: 'Move: First Project' }));
    const dialog = screen.getByRole('dialog');
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Lessons' })).toBeTruthy());
    await user.click(within(dialog).getByRole('button', { name: 'Lessons' }));
    await waitFor(() => expect(screen.queryByText('First Project')).toBeNull());

    const lessons = await harness.adapter.loadDirectory({ parentId: 1 });
    expect(lessons.projects.map((project) => project.id)).toContain('project-root-a');
  });

  test('renders copy in read-only mode while hiding every write action', async () => {
    const user = userEvent.setup();
    const copy = vi.fn();
    renderOrganizer({
      ownerId: 2,
      currentParentId: 20,
      renderProjectHostActions: (project, { readOnly }) => readOnly ? (
        <button type="button" aria-label={`Copy ${project.name}`} onClick={() => copy(project.id)}>Copy</button>
      ) : null
    });

    expect(await screen.findByText('Read-only Project')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Rename:/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Drag to reorder or move:/ })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Copy Read-only Project' }));
    expect(copy).toHaveBeenCalledWith('project-read-only');
  });

  test('renders a teacher distribution host action for writable projects', async () => {
    const user = userEvent.setup();
    const distribute = vi.fn();
    renderOrganizer({
      renderProjectExtraActions: (project) => (
        <button type="button" aria-label={`Distribute ${project.name}`} onClick={() => distribute(project.id)}>Send</button>
      )
    });

    await screen.findByText('First Project');
    await user.click(screen.getByRole('button', { name: 'Distribute First Project' }));
    expect(distribute).toHaveBeenCalledWith('project-root-a');
  });

  test('rolls optimistic ordering back when the request fails', async () => {
    const user = userEvent.setup();
    const harness = createMemoryOrganizerHarness();
    renderOrganizer({ harness });
    await screen.findByText('First Project');
    const original = projectOrder();
    harness.controls.failNext('repositionItem');

    await user.click(screen.getByRole('button', { name: 'Move down: First Project' }));
    expect((await screen.findByRole('alert')).textContent).toContain('repositionItem failed.');
    expect(projectOrder()).toEqual(original);
  });

  test('ignores an expired owner response after a rapid owner switch', async () => {
    const pending = new Map();
    const adapter = {
      loadDirectory: vi.fn(({ ownerId }) => new Promise((resolve) => pending.set(ownerId ?? 'me', resolve))),
      loadAllGroups: vi.fn(async () => []),
      createProject: vi.fn(),
      createGroup: vi.fn(),
      renameItem: vi.fn(),
      repositionItem: vi.fn(),
      deleteItem: vi.fn(),
      openProject: vi.fn()
    };
    const { rerender } = render(<ProjectOrganizer adapter={adapter} ownerId={null} />);
    rerender(<ProjectOrganizer adapter={adapter} ownerId={2} />);

    await act(async () => {
      pending.get(2)({
        projects: [{ kind: 'project', id: 'student', name: 'Student Project', parentId: null, sortOrder: 0, updatedAt: null }],
        groups: [],
        breadcrumbs: [],
        owner: { id: 2, username: 'Student' },
        readOnly: true
      });
    });
    expect(await screen.findByText('Student Project')).toBeTruthy();

    await act(async () => {
      pending.get('me')({
        projects: [{ kind: 'project', id: 'mine', name: 'Expired Project', parentId: null, sortOrder: 0, updatedAt: null }],
        groups: [],
        breadcrumbs: [],
        owner: { id: 1, username: 'Me' },
        readOnly: false
      });
    });
    expect(screen.queryByText('Expired Project')).toBeNull();
    expect(screen.getByText('Student Project')).toBeTruthy();
  });

  test('restores a controlled directory and reloads it after remounting', async () => {
    const harness = createMemoryOrganizerHarness();
    const ControlledOrganizer = () => {
      const [parentId, setParentId] = useState(1);
      return (
        <ProjectOrganizer
          adapter={harness.adapter}
          currentParentId={parentId}
          onCurrentParentIdChange={setParentId}
          messages={{ root: 'Root group' }}
        />
      );
    };
    const { unmount } = render(<ControlledOrganizer />);
    expect(await screen.findByText('Week One')).toBeTruthy();
    unmount();
    render(<ControlledOrganizer />);
    expect(await screen.findByText('Week One')).toBeTruthy();
  });

  test('supports mouse dragging to a middle position and to the end', async () => {
    const harness = createMemoryOrganizerHarness({
      owners: [{ id: 1, username: 'current-user', readOnly: false }],
      groups: [],
      projects: [
        { kind: 'project', id: 'a', name: 'Project A', parentId: null, sortOrder: 0, updatedAt: null, ownerId: 1 },
        { kind: 'project', id: 'b', name: 'Project B', parentId: null, sortOrder: 1, updatedAt: null, ownerId: 1 },
        { kind: 'project', id: 'c', name: 'Project C', parentId: null, sortOrder: 2, updatedAt: null, ownerId: 1 }
      ]
    });
    mockOrganizerRects();
    renderOrganizer({ harness });
    await screen.findByText('Project A');

    await mouseDrag(
      screen.getByRole('button', { name: 'Drag to reorder or move: Project A' }),
      { x: 340, y: 350 },
      { x: 640, y: 350 }
    );
    await waitFor(async () => {
      const root = await harness.adapter.loadDirectory({ parentId: null });
      expect(root.projects.map((project) => project.id)).toEqual(['b', 'a', 'c']);
    });

    await mouseDrag(
      screen.getByRole('button', { name: 'Drag to reorder or move: Project A' }),
      { x: 620, y: 350 },
      { x: 900, y: 350 }
    );
    await waitFor(async () => {
      const root = await harness.adapter.loadDirectory({ parentId: null });
      expect(root.projects.map((project) => project.id)).toEqual(['b', 'c', 'a']);
    });
  });

  test('supports mouse dragging across a group, an upper breadcrumb, and the root breadcrumb', async () => {
    const harness = createMemoryOrganizerHarness();
    mockOrganizerRects();
    const { rerender } = renderOrganizer({ harness });
    await screen.findByText('First Project');

    await mouseDrag(
      screen.getByRole('button', { name: 'Drag to reorder or move: First Project' }),
      { x: 340, y: 350 },
      { x: 80, y: 170 }
    );
    await waitFor(async () => {
      const lessons = await harness.adapter.loadDirectory({ parentId: 1 });
      expect(lessons.projects.map((project) => project.id)).toContain('project-root-a');
    });

    rerender(
      <ProjectOrganizer
        adapter={harness.adapter}
        currentParentId={3}
        messages={{ title: 'Projects', root: 'Root group' }}
      />
    );
    await screen.findByText('Deep Project');
    await mouseDrag(
      screen.getByRole('button', { name: 'Drag to reorder or move: Deep Project' }),
      { x: 340, y: 350 },
      { x: 300, y: 40 }
    );
    await waitFor(async () => {
      const weekOne = await harness.adapter.loadDirectory({ parentId: 2 });
      expect(weekOne.projects.map((project) => project.id)).toContain('project-deep');
    });

    rerender(
      <ProjectOrganizer
        adapter={harness.adapter}
        currentParentId={2}
        messages={{ title: 'Projects', root: 'Root group' }}
      />
    );
    await screen.findByText('Deep Project');
    await mouseDrag(
      screen.getByRole('button', { name: 'Drag to reorder or move: Deep Project' }),
      { x: 340, y: 350 },
      { x: 60, y: 40 }
    );
    await waitFor(async () => {
      const root = await harness.adapter.loadDirectory({ parentId: null });
      expect(root.projects.map((project) => project.id)).toContain('project-deep');
    });
  });

  test('activates and cancels keyboard drag through the installed keyboard sensor', async () => {
    const harness = createMemoryOrganizerHarness();
    mockOrganizerRects();
    renderOrganizer({ harness });
    await screen.findByText('First Project');
    const handle = screen.getByRole('button', { name: 'Drag to reorder or move: First Project' });
    handle.focus();

    fireEvent.keyDown(handle, { key: ' ', code: 'Space' });
    await waitFor(() => expect(document.querySelector('.tigao-organizer__drag-overlay')).toBeTruthy());
    fireEvent.keyDown(handle, { key: 'Escape', code: 'Escape' });

    await waitFor(() => expect(document.querySelector('.tigao-organizer__drag-overlay')).toBeFalsy());
    const root = await harness.adapter.loadDirectory({ parentId: null });
    expect(root.projects.map((project) => project.id)).toEqual(['project-root-a', 'project-root-b']);
  });
});
