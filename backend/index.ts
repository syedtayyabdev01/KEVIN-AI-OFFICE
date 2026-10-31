import {
  ai,
  db,
  json,
  error,
  requireAuth,
  router,
  secrets,
} from '@appdeploy/sdk';

type OfficeUser = { userId: string; email?: string; name?: string };
type TaskRecord = {
  title: string;
  description: string;
  assignedEmployeeId: string;
  assignedEmployeeName: string;
  priority: string;
  status: string;
  createdAt: number;
  createdBy: string;
  result?: string;
};
type ApprovalRecord = {
  title: string;
  reason: string;
  requestedBy: string;
  status: string;
  createdAt: number;
  decidedAt?: number;
  decidedBy?: string;
};
type EmployeeRecord = {
  name: string;
  role: string;
  department: string;
  status: string;
  currentTask: string;
  model: string;
};

function keyFor(userId: string) {
  const key = userId.replace(/[^A-Za-z0-9_-]/g, '');
  if (!key || key.length > 90) throw new Error('Invalid account identifier');
  return key;
}

function tables(userId: string) {
  const key = keyFor(userId);
  return {
    employees: 'employees_' + key,
    tasks: 'tasks_' + key,
    approvals: 'approvals_' + key,
    messages: 'messages_' + key,
    activity: 'activity_' + key,
  };
}

const employeeSeed: EmployeeRecord[] = [
  {
    name: 'Kevin Manager',
    role: 'Central AI Coordinator',
    department: 'Management',
    status: 'Idle',
    currentTask: '',
    model: 'Platform-managed AI',
  },
  {
    name: 'TradingView Agent',
    role: 'Market Research Specialist',
    department: 'Trading',
    status: 'Idle',
    currentTask: '',
    model: 'Platform-managed AI',
  },
  {
    name: 'Telegram Manager',
    role: 'Messaging Operations Specialist',
    department: 'Telegram',
    status: 'Idle',
    currentTask: '',
    model: 'Platform-managed AI',
  },
  {
    name: 'News Intelligence',
    role: 'Financial News Researcher',
    department: 'News',
    status: 'Idle',
    currentTask: '',
    model: 'Platform-managed AI',
  },
  {
    name: 'Student Manager',
    role: 'Academy Operations Specialist',
    department: 'Student Academy',
    status: 'Idle',
    currentTask: '',
    model: 'Platform-managed AI',
  },
  {
    name: 'Web Developer',
    role: 'Web Engineering Specialist',
    department: 'Development',
    status: 'Idle',
    currentTask: '',
    model: 'Platform-managed AI',
  },
  {
    name: 'Python Automation',
    role: 'Automation Specialist',
    department: 'Automation',
    status: 'Idle',
    currentTask: '',
    model: 'Platform-managed AI',
  },
  {
    name: 'Social Media Manager',
    role: 'Content Operations Specialist',
    department: 'Social Media',
    status: 'Idle',
    currentTask: '',
    model: 'Platform-managed AI',
  },
  {
    name: 'PC Manager',
    role: 'Local Systems Specialist',
    department: 'PC Management',
    status: 'Idle',
    currentTask: '',
    model: 'Platform-managed AI',
  },
];

async function ensureEmployees(userId: string) {
  const t = tables(userId);
  const current = await db.list<EmployeeRecord>(t.employees, { limit: 20 });
  if (current.items.length === 0) {
    await db.tx.add(
      t.employees,
      employeeSeed.map((employee, index) => ({
        id: 'employee_' + String(index + 1).padStart(2, '0'),
        ...employee,
        createdAt: Date.now(),
      }))
    );
  }
  return db.list<EmployeeRecord>(t.employees, { limit: 20 });
}

async function recordActivity(userId: string, action: string, detail: string) {
  const t = tables(userId);
  await db.add(t.activity, [
    { action, detail, createdAt: Date.now(), actorId: userId },
  ]);
}

async function isOwner(user: OfficeUser) {
  if (!user.email) return false;
  const names = await secrets.listSecretNames();
  if (!names.includes('OWNER_EMAIL')) return false;
  const configured = (await secrets.readSecret('OWNER_EMAIL'))
    .trim()
    .toLowerCase();
  return configured.length > 0 && configured === user.email.toLowerCase();
}

async function requireOwner(ctx: { user?: OfficeUser }) {
  if (!ctx.user || !(await isOwner(ctx.user))) {
    return error(
      'Owner authorization is not configured for this account.',
      403
    );
  }
}

function routeEmployee(
  message: string,
  employees: Array<{ id: string; name: string; department: string }>
) {
  const text = message.toLowerCase();
  const match =
    text.includes('gold') ||
    text.includes('forex') ||
    text.includes('trade') ||
    text.includes('btc') ||
    text.includes('xau')
      ? 'Trading'
      : text.includes('telegram') ||
          text.includes('message') ||
          text.includes('vip group')
        ? 'Telegram'
        : text.includes('news') ||
            text.includes('calendar') ||
            text.includes('central bank')
          ? 'News'
          : text.includes('student') ||
              text.includes('academy') ||
              text.includes('attendance') ||
              text.includes('fee')
            ? 'Student Academy'
            : text.includes('website') ||
                text.includes('web') ||
                text.includes('github') ||
                text.includes('frontend')
              ? 'Development'
              : text.includes('python') ||
                  text.includes('excel') ||
                  text.includes('csv') ||
                  text.includes('automation')
                ? 'Automation'
                : text.includes('social') ||
                    text.includes('instagram') ||
                    text.includes('tiktok') ||
                    text.includes('caption')
                  ? 'Social Media'
                  : text.includes('pc') ||
                      text.includes('windows') ||
                      text.includes('computer')
                    ? 'PC Management'
                    : 'Management';
  return (
    employees.find(employee => employee.department === match) || employees[0]
  );
}

function workerTables(userId: string) {
  const key = keyFor(userId);
  return {
    pairings: 'worker_pairings_' + key,
    devices: 'worker_devices_' + key,
    tasks: tables(userId).tasks,
  };
}

function makeWorkerToken() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  return Array.from({ length: 64 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
}

async function findWorkerByToken(token: string) {
  if (!token || token.length < 40 || token.length > 100) return null;
  const page = await db.list<{ userId: string; deviceId: string; token: string; name: string }>('worker_registry', { limit: 1000 });
  return page.items.find(item => item.token === token) || null;
}

export const handler = router({
  'GET /api/health': [
    async () => json({ ok: true, service: 'KEVIN AI OFFICE API' }),
  ],

  'GET /api/office': [
    requireAuth(),
    async ctx => {
      const userId = ctx.user!.userId;
      const t = tables(userId);
      const [
        employeePage,
        taskPage,
        approvalPage,
        messagePage,
        ownerConfigured,
      ] = await Promise.all([
        ensureEmployees(userId),
        db.list<TaskRecord>(t.tasks, { limit: 50 }),
        db.list<ApprovalRecord>(t.approvals, { limit: 50 }),
        db.list<{
          role: 'user' | 'assistant';
          content: string;
          createdAt: number;
        }>(t.messages, { limit: 40 }),
        isOwner(ctx.user!),
      ]);
      const employees = employeePage.items;
      const tasks = taskPage.items.sort((a, b) => b.createdAt - a.createdAt);
      const approvals = approvalPage.items.sort(
        (a, b) => b.createdAt - a.createdAt
      );
      const messages = messagePage.items.sort(
        (a, b) => a.createdAt - b.createdAt
      );
      return json({
        employees,
        tasks,
        approvals,
        messages,
        ownerConfigured,
        stats: {
          totalTasks: tasks.length,
          completedTasks: tasks.filter(task => task.status === 'Completed')
            .length,
          pendingTasks: tasks.filter(task =>
            ['Pending', 'Queued', 'Waiting for approval'].includes(task.status)
          ).length,
          failedTasks: tasks.filter(task => task.status === 'Failed').length,
          activeEmployees: employees.filter(employee =>
            ['Working', 'Thinking'].includes(employee.status)
          ).length,
        },
      });
    },
  ],

  'POST /api/tasks': [
    requireAuth(),
    async ctx => {
      const body = (ctx.body || {}) as {
        title?: string;
        description?: string;
        priority?: string;
        assignedEmployeeId?: string;
      };
      const title = (body.title || '').trim();
      if (!title) return error('Task title is required.', 400);
      if (title.length > 120)
        return error('Task title must be 120 characters or fewer.', 400);
      const userId = ctx.user!.userId;
      const t = tables(userId);
      const employeePage = await ensureEmployees(userId);
      const employee =
        employeePage.items.find(item => item.id === body.assignedEmployeeId) ||
        employeePage.items[0];
      const record: TaskRecord = {
        title,
        description: (body.description || '').slice(0, 4000),
        assignedEmployeeId: employee.id,
        assignedEmployeeName: employee.name,
        priority: ['Low', 'Normal', 'High', 'Urgent'].includes(
          body.priority || ''
        )
          ? body.priority!
          : 'Normal',
        status: 'Pending',
        createdAt: Date.now(),
        createdBy: userId,
      };
      const [id] = await db.add(t.tasks, [record]);
      if (!id) return error('The task could not be saved.', 500);
      await recordActivity(userId, 'task.created', title);
      return json({ id, ...record }, 201);
    },
  ],

  'PUT /api/tasks/:id': [
    requireAuth(),
    async ctx => {
      const body = (ctx.body || {}) as { status?: string };
      const allowed = [
        'Pending',
        'Queued',
        'Running',
        'Waiting for approval',
        'Completed',
        'Failed',
        'Cancelled',
      ];
      if (!allowed.includes(body.status || ''))
        return error('Invalid task status.', 400);
      const t = tables(ctx.user!.userId);
      const [current] = await db.get<TaskRecord>(t.tasks, [ctx.params.id]);
      if (!current) return error('Task not found.', 404);
      const [updated] = await db.tx.update(
        t.tasks,
        [
          {
            id: ctx.params.id,
            record: { status: body.status, updatedAt: Date.now() },
          },
        ],
        { patch: true }
      );
      if (!updated) return error('Task could not be updated.', 409);
      await recordActivity(
        ctx.user!.userId,
        'task.status_changed',
        current.title + ' → ' + body.status
      );
      return json({ ok: true, status: body.status });
    },
  ],

  'POST /api/assistant': [
    requireAuth(),
    async ctx => {
      const body = (ctx.body || {}) as { message?: string };
      const message = (body.message || '').trim();
      if (!message) return error('Write a message first.', 400);
      if (message.length > 6000) return error('Message is too long.', 400);
      const userId = ctx.user!.userId;
      const t = tables(userId);
      const employeePage = await ensureEmployees(userId);
      const employee = routeEmployee(message, employeePage.items);
      const actionable =
        /\b(prepare|create|build|check|review|analy[sz]e|send|manage|update|find|generate|organize|fix|research|summari[sz]e|plan|export|import)\b/i.test(
          message
        );
      let task: { id: string; title: string } | null = null;
      if (actionable) {
        const title =
          message.length > 90 ? message.slice(0, 87) + '...' : message;
        const [id] = await db.add(t.tasks, [
          {
            title,
            description: message,
            assignedEmployeeId: employee.id,
            assignedEmployeeName: employee.name,
            priority: 'Normal',
            status: 'Pending',
            createdAt: Date.now(),
            createdBy: userId,
          },
        ]);
        if (id) task = { id, title };
      }
      await db.add(t.messages, [
        { role: 'user', content: message, createdAt: Date.now() },
      ]);
      let answer = '';
      try {
        const result = await ai.generate({
          system:
            'You are Kevin Manager, the coordinator of a private AI employee office. Be concise, practical, and honest. You can prepare plans and route tasks, but do not claim external operations, integrations, or background workers have executed. If a task was created, clearly say it is Pending and awaiting a connected worker. Restricted actions require owner approval. Never invent live market data, student records, payment status, or integration results.',
          prompt:
            'User request: ' +
            message +
            '\nAssigned specialist: ' +
            employee.name +
            ' (' +
            employee.department +
            ').\nTask record: ' +
            (task
              ? task.id + ' / Pending'
              : 'No task created; this appears conversational'
            ).concat(
              '\nRespond with a short execution plan, identify any missing integration or approval, and clearly state what has and has not happened.'
            ),
          maxTokens: 700,
          temperature: 0.4,
        });
        answer = result.text;
      } catch (err) {
        answer =
          'I could not reach the AI generation service, so no AI plan was produced. ' +
          (task
            ? 'Your task is saved as Pending with ID ' + task.id + '.'
            : 'Please retry when the AI service is available.');
      }
      if (task)
        answer +=
          '\n\nTask created: ' +
          task.id +
          ' · Pending · Assigned to ' +
          employee.name +
          '. No department worker has executed it yet.';
      const [messageId] = await db.add(t.messages, [
        { role: 'assistant', content: answer, createdAt: Date.now() },
      ]);
      await recordActivity(userId, 'assistant.request', message.slice(0, 180));
      return json({
        message: {
          id: messageId,
          role: 'assistant',
          content: answer,
          createdAt: Date.now(),
        },
        task,
      });
    },
  ],

  'GET /api/workers/:id/messages': [
    requireAuth(),
    async ctx => {
      const userId = ctx.user!.userId;
      const employeePage = await ensureEmployees(userId);
      const employee = employeePage.items.find(item => item.id === ctx.params.id);
      if (!employee) return error('Worker not found.', 404);
      const table = 'worker_messages_' + keyFor(userId) + '_' + ctx.params.id;
      const page = await db.list<{ role: 'user' | 'assistant'; content: string; createdAt: number }>(table, { limit: 80 });
      return json({ messages: page.items.sort((a, b) => a.createdAt - b.createdAt) });
    },
  ],

  'POST /api/workers/:id/chat': [
    requireAuth(),
    async ctx => {
      const body = (ctx.body || {}) as { message?: string };
      const message = (body.message || '').trim();
      if (!message) return error('Write a message first.', 400);
      if (message.length > 6000) return error('Message is too long.', 400);
      const userId = ctx.user!.userId;
      const employeePage = await ensureEmployees(userId);
      const employee = employeePage.items.find(item => item.id === ctx.params.id);
      if (!employee) return error('Worker not found.', 404);
      const table = 'worker_messages_' + keyFor(userId) + '_' + ctx.params.id;
      const history = await db.list<{ role: 'user' | 'assistant'; content: string; createdAt: number }>(table, { limit: 18 });
      await db.add(table, [{ role: 'user', content: message, createdAt: Date.now() }]);
      const persona = 'You are ' + employee.name + ', a specialist AI employee in the ' + employee.department + ' department. Your role: ' + employee.role + '. Speak directly to your employer in a natural, warm, professional way. Be proactive and practical. Do useful work in your response: produce requested drafts, checklists, code snippets, analyses, plans, calculations or structured deliverables rather than merely saying you will do them. Ask one concise clarification only when truly necessary. Never invent access to files, devices, accounts, live market feeds or external services. Never claim that a message was sent, code was changed, a repository was modified, a payment was updated, a post was published or a local command was run unless a connected tool confirms it. For actions requiring external systems, explain the missing connection and prepare the exact next step. Sensitive or public actions require explicit owner approval.';
      let answer = '';
      try {
        const result = await ai.generate({
          system: persona,
          prompt: 'Recent conversation:\n' + history.items.sort((a, b) => a.createdAt - b.createdAt).slice(-12).map(item => item.role + ': ' + item.content).join('\n') + '\nuser: ' + message + '\nRespond as the specialist. If asked to do work, provide the actual deliverable you can produce here and clearly separate completed in-chat work from external actions that remain unexecuted.',
          maxTokens: 1200,
          temperature: 0.45,
        });
        answer = result.text;
      } catch {
        return error('The AI service is unavailable. Your message was saved; please retry.', 503);
      }
      const [id] = await db.add(table, [{ role: 'assistant', content: answer, createdAt: Date.now() }]);
      await recordActivity(userId, 'worker.chat', employee.name + ': ' + message.slice(0, 140));
      return json({ message: { id, role: 'assistant', content: answer, createdAt: Date.now() } });
    },
  ],

  'POST /api/approvals': [ 
    requireAuth(),
    async ctx => {
      const body = (ctx.body || {}) as { title?: string; reason?: string };
      const title = (body.title || '').trim();
      if (!title) return error('Approval title is required.', 400);
      const t = tables(ctx.user!.userId);
      const record: ApprovalRecord = {
        title: title.slice(0, 180),
        reason: (body.reason || '').slice(0, 1500),
        requestedBy: ctx.user!.userId,
        status: 'pending',
        createdAt: Date.now(),
      };
      const [id] = await db.add(t.approvals, [record]);
      if (!id) return error('Approval request could not be saved.', 500);
      await recordActivity(ctx.user!.userId, 'approval.requested', title);
      return json({ id, ...record }, 201);
    },
  ],

  'PUT /api/approvals/:id': [
    requireAuth(),
    async ctx => {
      const denied = await requireOwner(ctx);
      if (denied) return denied;
      const body = (ctx.body || {}) as { status?: string };
      if (!['approved', 'rejected'].includes(body.status || ''))
        return error('Decision must be approved or rejected.', 400);
      const t = tables(ctx.user!.userId);
      const [current] = await db.get<ApprovalRecord>(t.approvals, [
        ctx.params.id,
      ]);
      if (!current) return error('Approval request not found.', 404);
      if (current.status !== 'pending')
        return error('This request has already been decided.', 409);
      const [updated] = await db.tx.update(
        t.approvals,
        [
          {
            id: ctx.params.id,
            record: {
              status: body.status,
              decidedAt: Date.now(),
              decidedBy: ctx.user!.userId,
            },
          },
        ],
        { patch: true }
      );
      if (!updated) return error('Approval decision could not be saved.', 409);
      await recordActivity(
        ctx.user!.userId,
        'approval.' + body.status,
        current.title
      );
      return json({ ok: true, status: body.status });
    },
  ],

  'GET /api/worker/status': [
    requireAuth(),
    async ctx => {
      const t = workerTables(ctx.user!.userId);
      const page = await db.list<{ name: string; lastSeen: number; createdAt: number }>(t.devices, { limit: 10 });
      const devices = page.items.map(device => ({
        id: device.id,
        name: device.name,
        status: Date.now() - device.lastSeen < 45000 ? 'Online' : 'Offline',
        lastSeen: device.lastSeen,
        createdAt: device.createdAt,
      }));
      return json({ devices, online: devices.some(device => device.status === 'Online') });
    },
  ],

  'POST /api/worker/pair': [
    requireAuth(),
    async ctx => {
      const code = String(Math.floor(10000000 + Math.random() * 90000000));
      const expiresAt = Date.now() + 10 * 60 * 1000;
      const [id] = await db.add('worker_pairings', [{
        code,
        userId: ctx.user!.userId,
        expiresAt,
        used: false,
        createdAt: Date.now(),
      }]);
      if (!id) return error('Could not create a pairing code. Please retry.', 500);
      await recordActivity(ctx.user!.userId, 'worker.pairing_created', 'Windows worker pairing code created');
      return json({ code, expiresAt });
    },
  ],

  'POST /api/worker/enroll': [
    async ctx => {
      const body = (ctx.body || {}) as { code?: string; name?: string };
      const code = (body.code || '').trim();
      if (!/^\\d{8}$/.test(code)) return error('Enter the 8-digit pairing code.', 400);
      const pairings = await db.list<{ code: string; userId: string; expiresAt: number; used: boolean }>('worker_pairings', { limit: 1000 });
      const pairing = pairings.items.find(item => item.code === code && !item.used && item.expiresAt > Date.now());
      if (!pairing) return error('Pairing code is invalid, expired or already used.', 400);
      const token = makeWorkerToken();
      const name = (body.name || 'Windows PC').trim().slice(0, 80) || 'Windows PC';
      const deviceTable = workerTables(pairing.userId).devices;
      const [deviceId] = await db.add(deviceTable, [{
        name,
        status: 'Online',
        lastSeen: Date.now(),
        createdAt: Date.now(),
      }]);
      if (!deviceId) return error('Could not register this device.', 500);
      const [registryId] = await db.add('worker_registry', [{
        userId: pairing.userId,
        deviceId,
        token,
        name,
        createdAt: Date.now(),
      }]);
      if (!registryId) return error('Device registration was incomplete. Generate a new pairing code.', 500);
      await db.tx.update('worker_pairings', [{
        id: pairing.id,
        record: { used: true, usedAt: Date.now() },
      }], { patch: true });
      return json({ ok: true, token, deviceId, name });
    },
  ],

  'POST /api/worker/heartbeat': [
    async ctx => {
      const body = (ctx.body || {}) as { token?: string };
      const worker = await findWorkerByToken(body.token || '');
      if (!worker) return error('Worker authentication failed.', 401);
      await db.tx.update(workerTables(worker.userId).devices, [{
        id: worker.deviceId,
        record: { lastSeen: Date.now(), status: 'Online' },
      }], { patch: true });
      return json({ ok: true, serverTime: Date.now() });
    },
  ],

  'POST /api/worker/poll': [
    async ctx => {
      const body = (ctx.body || {}) as { token?: string };
      const worker = await findWorkerByToken(body.token || '');
      if (!worker) return error('Worker authentication failed.', 401);
      const t = workerTables(worker.userId);
      await db.tx.update(t.devices, [{
        id: worker.deviceId,
        record: { lastSeen: Date.now(), status: 'Online' },
      }], { patch: true });
      const page = await db.list<TaskRecord>(t.tasks, { limit: 100 });
      const task = page.items
        .filter(item => item.status === 'Queued')
        .sort((a, b) => a.createdAt - b.createdAt)[0];
      if (!task) return json({ task: null });
      const [updated] = await db.tx.update(t.tasks, [{
        id: task.id,
        record: { status: 'Running', workerDeviceId: worker.deviceId, startedAt: Date.now() },
        if: { status: 'Queued' },
      }], { patch: true });
      if (!updated) return json({ task: null });
      return json({ task: { ...task, status: 'Running' } });
    },
  ],

  'POST /api/worker/complete': [
    async ctx => {
      const body = (ctx.body || {}) as { token?: string; taskId?: string; status?: string; result?: string };
      const worker = await findWorkerByToken(body.token || '');
      if (!worker) return error('Worker authentication failed.', 401);
      if (!body.taskId || !['Completed', 'Failed'].includes(body.status || '')) {
        return error('A task ID and Completed or Failed status are required.', 400);
      }
      const t = workerTables(worker.userId);
      const [task] = await db.get<TaskRecord & { workerDeviceId?: string }>(t.tasks, [body.taskId]);
      if (!task || task.status !== 'Running' || task.workerDeviceId !== worker.deviceId) {
        return error('This task is not assigned to this worker.', 409);
      }
      const [updated] = await db.tx.update(t.tasks, [{
        id: body.taskId,
        record: {
          status: body.status,
          result: (body.result || '').slice(0, 12000),
          completedAt: Date.now(),
        },
        if: { status: 'Running', workerDeviceId: worker.deviceId },
      }], { patch: true });
      if (!updated) return error('Task result could not be saved.', 409);
      await recordActivity(worker.userId, 'worker.task_' + body.status.toLowerCase(), task.title);
      return json({ ok: true, status: body.status });
    },
  ],

  'GET /api/integrations/status': [
    requireAuth(),
    async ctx => {
      const names = await secrets.listSecretNames();
      return json({
        ownerConfigured: await isOwner(ctx.user!),
        providers: {
          openai: names.includes('OPENAI_API_KEY')
            ? 'credentials_present_test_required'
            : 'configuration_required',
          anthropic: names.includes('ANTHROPIC_API_KEY')
            ? 'credentials_present_test_required'
            : 'configuration_required',
          gemini: names.includes('GEMINI_API_KEY')
            ? 'credentials_present_test_required'
            : 'configuration_required',
          telegram: names.includes('TELEGRAM_BOT_TOKEN')
            ? 'credentials_present_test_required'
            : 'configuration_required',
        },
      });
    },
  ],
});
