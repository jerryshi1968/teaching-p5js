const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const backendRoot = path.resolve(__dirname, '..');

const loadWithMocks = (relativeModulePath, mocks) => {
  const modulePath = require.resolve(path.join(backendRoot, relativeModulePath));
  const saved = new Map();

  for (const [relativeMockPath, exports] of Object.entries(mocks)) {
    const mockPath = require.resolve(path.join(backendRoot, relativeMockPath));
    saved.set(mockPath, require.cache[mockPath]);
    require.cache[mockPath] = { id: mockPath, filename: mockPath, loaded: true, exports };
  }

  delete require.cache[modulePath];
  const loaded = require(modulePath);
  delete require.cache[modulePath];
  for (const [mockPath, entry] of saved) {
    if (entry) require.cache[mockPath] = entry;
    else delete require.cache[mockPath];
  }
  return loaded;
};

const createResponse = () => ({
  statusCode: 200,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  }
});

test('all-groups keeps current-user and teacher-visible student ownership isolated', async () => {
  const ownerIds = [];
  let studentVisible = true;
  const controller = loadWithMocks('controllers/projectGroupController.js', {
    'models/projectModel.js': {},
    'models/projectGroupModel.js': {
      listAllForUser: async (ownerId) => {
        ownerIds.push(ownerId);
        return [{ id: ownerId * 10 }];
      }
    },
    'models/userModel.js': {
      isStudentVisibleToTeacher: async () => studentVisible
    }
  });

  const ownResponse = createResponse();
  await controller.listAllGroups({ user: { id: 7, role: 'student' }, query: {} }, ownResponse, assert.fail);
  assert.deepEqual(ownerIds, [7]);
  assert.deepEqual(ownResponse.body, { groups: [{ id: 70 }] });

  const studentResponse = createResponse();
  await controller.listAllGroups({ user: { id: 3, role: 'teacher' }, query: { studentId: '9' } }, studentResponse, assert.fail);
  assert.deepEqual(ownerIds, [7, 9]);
  assert.deepEqual(studentResponse.body, { groups: [{ id: 90 }] });

  studentVisible = false;
  const forbiddenResponse = createResponse();
  await controller.listAllGroups({ user: { id: 3, role: 'teacher' }, query: { studentId: '11' } }, forbiddenResponse, assert.fail);
  assert.equal(forbiddenResponse.statusCode, 403);
  assert.deepEqual(ownerIds, [7, 9]);
});

test('project and group reads retain p5js type and user filters', async () => {
  const queries = [];
  const db = {
    query: async (sql, params) => {
      queries.push({ sql, params });
      return [[]];
    }
  };
  const Project = loadWithMocks('models/projectModel.js', { 'config/db.js': db });
  const ProjectGroup = loadWithMocks('models/projectGroupModel.js', { 'config/db.js': db });

  await Project.listForUser(8, null);
  await ProjectGroup.listForUser({ userId: 8, parentId: 4 });
  assert.match(queries[0].sql, /project_type = 'p5js'/);
  assert.deepEqual(queries[0].params, [8]);
  assert.match(queries[1].sql, /project_type = 'p5js'/);
  assert.deepEqual(queries[1].params, [8, 4]);
});

test('cross-user project access is denied except for a teacher relationship', async () => {
  const queries = [];
  const db = {
    query: async (sql, params) => {
      queries.push({ sql, params });
      return [[{ id: 'student-project' }]];
    }
  };
  const Project = loadWithMocks('models/projectModel.js', { 'config/db.js': db });

  assert.equal(await Project.listVisibleToUser({
    currentUser: { id: 1, role: 'student' },
    studentId: 2,
    parentId: null
  }), null);
  assert.equal(queries.length, 0);

  const visible = await Project.listVisibleToUser({
    currentUser: { id: 5, role: 'teacher' },
    studentId: 2,
    parentId: 3
  });
  assert.deepEqual(visible, [{ id: 'student-project' }]);
  assert.match(queries[0].sql, /p\.project_type = 'p5js'/);
  assert.match(queries[0].sql, /p\.parent_id/);
  assert.match(queries[0].sql, /p\.sort_order/);
  assert.match(queries[0].sql, /c\.teacher_user_id = \?/);
  assert.deepEqual(queries[0].params, [2, 5, 3]);
});

test('project reposition appends across groups and normalizes each project sequence transactionally', async () => {
  const statements = [];
  const connection = {
    beginTransaction: async () => statements.push({ type: 'begin' }),
    commit: async () => statements.push({ type: 'commit' }),
    rollback: async () => statements.push({ type: 'rollback' }),
    release: () => statements.push({ type: 'release' }),
    query: async (sql, params) => {
      statements.push({ type: 'query', sql, params });
      if (/SELECT id, parent_id FROM projects/.test(sql)) return [[{ id: 'a', parent_id: null }]];
      if (/SELECT id FROM project_groups/.test(sql)) return [[{ id: 10 }]];
      if (/SELECT id FROM projects/.test(sql) && params.length === 1) return [[{ id: 'a' }, { id: 'b' }]];
      if (/SELECT id FROM projects/.test(sql) && params.length === 2) return [[{ id: 'c' }]];
      return [{ affectedRows: 1 }];
    }
  };
  const Project = loadWithMocks('models/projectModel.js', { 'config/db.js': { getConnection: async () => connection } });

  const result = await Project.reposition({ projectId: 'a', userId: 1, parentId: 10, beforeId: null });
  assert.deepEqual(result, { status: 'updated' });
  assert.equal(statements.some((statement) => statement.type === 'query' && /FOR UPDATE/.test(statement.sql)), true);
  assert.equal(statements.some((statement) => statement.type === 'query' && /UPDATE project_groups/.test(statement.sql)), false);
  assert.equal(statements.some((statement) => statement.type === 'query' && /UPDATE projects SET sort_order/.test(statement.sql) && statement.params.join(',') === '1,a,1,10'), true);
  assert.deepEqual(statements.filter((statement) => statement.type !== 'query').map((statement) => statement.type), ['begin', 'commit', 'release']);
});

test('invalid beforeId rolls the project transaction back without partial changes', async () => {
  const events = [];
  const connection = {
    beginTransaction: async () => events.push('begin'),
    commit: async () => events.push('commit'),
    rollback: async () => events.push('rollback'),
    release: () => events.push('release'),
    query: async (sql) => {
      if (/SELECT id, parent_id FROM projects/.test(sql)) return [[{ id: 'a', parent_id: null }]];
      if (/SELECT id FROM projects/.test(sql)) return [[{ id: 'a' }, { id: 'b' }]];
      return [{ affectedRows: 1 }];
    }
  };
  const Project = loadWithMocks('models/projectModel.js', { 'config/db.js': { getConnection: async () => connection } });

  assert.deepEqual(await Project.reposition({ projectId: 'a', userId: 1, parentId: null, beforeId: 'missing' }), { status: 'invalid_before' });
  assert.deepEqual(events, ['begin', 'rollback', 'release']);
});

test('transaction errors roll back and release the project connection', async () => {
  const events = [];
  const connection = {
    beginTransaction: async () => events.push('begin'),
    commit: async () => events.push('commit'),
    rollback: async () => events.push('rollback'),
    release: () => events.push('release'),
    query: async (sql) => {
      if (/SELECT id, parent_id FROM projects/.test(sql)) return [[{ id: 'a', parent_id: null }]];
      if (/SELECT id FROM projects/.test(sql)) return [[{ id: 'a' }, { id: 'b' }]];
      if (/UPDATE projects SET parent_id/.test(sql)) throw new Error('write failed');
      return [{ affectedRows: 1 }];
    }
  };
  const Project = loadWithMocks('models/projectModel.js', { 'config/db.js': { getConnection: async () => connection } });

  await assert.rejects(() => Project.reposition({ projectId: 'a', userId: 1, parentId: null, beforeId: null }), /write failed/);
  assert.deepEqual(events, ['begin', 'rollback', 'release']);
});

test('group reposition rejects self, descendants, and invalid beforeId', async () => {
  const baseGroup = { id: 1, parent_id: null };
  const makeController = (overrides = {}) => loadWithMocks('controllers/projectGroupController.js', {
    'models/projectModel.js': {},
    'models/projectGroupModel.js': {
      findOwnedById: async ({ id }) => id === 1 || id === 2 ? baseGroup : null,
      isDescendantOf: async () => false,
      reposition: async () => ({ status: 'updated' }),
      ...overrides
    },
    'models/userModel.js': {}
  });
  const request = (body) => ({ user: { id: 4 }, params: { id: '1' }, body });

  let response = createResponse();
  await makeController().repositionGroup(request({ parentId: 1, beforeId: null }), response, assert.fail);
  assert.equal(response.statusCode, 400);

  response = createResponse();
  await makeController({ isDescendantOf: async () => true }).repositionGroup(request({ parentId: 2, beforeId: null }), response, assert.fail);
  assert.equal(response.statusCode, 400);

  response = createResponse();
  await makeController({ reposition: async () => ({ status: 'invalid_before' }) }).repositionGroup(request({ parentId: null, beforeId: 99 }), response, assert.fail);
  assert.equal(response.statusCode, 400);
});

test('project and group reposition routes are explicit and keep the legacy move aliases', () => {
  const projectRoutes = fs.readFileSync(path.join(backendRoot, 'routes', 'projects.js'), 'utf8');
  const groupRoutes = fs.readFileSync(path.join(backendRoot, 'routes', 'projectGroups.js'), 'utf8');
  assert.match(projectRoutes, /router\.put\('\/:id\/reposition', projectController\.repositionProject\)/);
  assert.match(projectRoutes, /router\.put\('\/:id\/move', projectController\.moveProject\)/);
  assert.match(groupRoutes, /router\.put\('\/:id\/reposition', projectGroupController\.repositionGroup\)/);
  assert.match(groupRoutes, /router\.put\('\/:id\/move', projectGroupController\.moveGroup\)/);
});
