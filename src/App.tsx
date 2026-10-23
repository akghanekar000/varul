import { useEffect, useMemo, useState } from 'react';
import Editor from '@monaco-editor/react';
import {
  Activity, Bot, ChevronRight, Code2, FolderOpen, LayoutDashboard,
  LogOut, MessageSquareText, Play, Search, Settings, ShieldCheck,
  Sparkles, TerminalSquare, TestTube2, Users, Zap, FolderCog, CheckCircle2,
  AlertTriangle, Database, BriefcaseBusiness, GitBranch, FileJson, FileText,
  PanelLeftClose, PanelLeftOpen
} from 'lucide-react';

type NavTab =
  | 'Dashboard'
  | 'Projects'
  | 'AI Engineer'
  | 'Code Review'
  | 'Testing'
  | 'Model Settings'
  | 'Usage'
  | 'Account Settings';

type FileNode = {
  id: string;
  path: string;
  language: string;
  content: string;
  status?: 'clean' | 'modified';
};

type Project = {
  id: string;
  name: string;
  template: string;
  summary: string;
  status: string;
  lastUpdated: string;
  files: FileNode[];
};

type Message = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  time: string;
};

const tabs: NavTab[] = [
  'Dashboard',
  'Projects',
  'AI Engineer',
  'Code Review',
  'Testing',
  'Model Settings',
  'Usage',
  'Account Settings'
];

const initialProjects: Project[] = [
  {
    id: 'acme-portal',
    name: 'Acme Portal',
    template: 'React + TypeScript',
    summary: 'Customer portal with dashboards, billing, and workflow automations.',
    status: 'Active',
    lastUpdated: '2 hours ago',
    files: [
      {
        id: 'src/App.tsx',
        path: 'src/App.tsx',
        language: 'typescript',
        content: `export default function App() {\n  return (\n    <main className="min-h-screen bg-slate-950 text-white p-8">\n      <h1 className="text-3xl font-bold">Acme Portal</h1>\n      <p className="mt-3 text-slate-300">Operations, billing, and support in one workspace.</p>\n    </main>\n  );\n}\n`,
        status: 'clean'
      },
      {
        id: 'src/lib/metrics.ts',
        path: 'src/lib/metrics.ts',
        language: 'typescript',
        content: `export const revenueTarget = 2400000;\nexport const currentRunRate = 1985000;\n`,
        status: 'modified'
      },
      {
        id: 'README.md',
        path: 'README.md',
        language: 'markdown',
        content: '# Acme Portal\n\nProduction-ready internal portal for operations, billing, and support tasks.\n',
        status: 'clean'
      }
    ]
  },
  {
    id: 'billing-api',
    name: 'Billing API',
    template: 'REST API',
    summary: 'Secure service for invoice generation, payment webhooks, and retry logic.',
    status: 'Deploy-ready',
    lastUpdated: 'Today',
    files: [
      {
        id: 'src/server.ts',
        path: 'src/server.ts',
        language: 'typescript',
        content: `import express from 'express';\n\nconst app = express();\n\napp.get('/health', (_req, res) => res.json({ ok: true }));\n\napp.listen(3000);\n`,
        status: 'clean'
      },
      {
        id: 'tests/invoice.test.ts',
        path: 'tests/invoice.test.ts',
        language: 'typescript',
        content: `describe('invoice service', () => {\n  it('creates invoice payload', () => {\n    expect(true).toBe(true);\n  });\n});\n`,
        status: 'modified'
      }
    ]
  }
];

const emptyMessage: Message = {
  id: 'empty-msg',
  role: 'assistant',
  text: 'I can review the project, propose a plan, and generate the next patch. Ask for a feature, bug fix, or system design update.',
  time: 'now'
};

function readProjects() {
  const cached = localStorage.getItem('devmind-projects');
  if (!cached) return initialProjects;

  try {
    const parsed = JSON.parse(cached) as Project[];
    return parsed.length ? parsed : initialProjects;
  } catch {
    return initialProjects;
  }
}

function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('Dashboard');
  const [projects, setProjects] = useState<Project[]>(() => readProjects());
  const [projectId, setProjectId] = useState<string>(initialProjects[0].id);
  const [selectedFile, setSelectedFile] = useState<string>('src/App.tsx');
  const [messages, setMessages] = useState<Message[]>([emptyMessage]);
  const [input, setInput] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [terminalLog, setTerminalLog] = useState<string[]>([
    '$ npm run test',
    '✓ build passed',
    '✓ lint passed'
  ]);

  useEffect(() => {
    localStorage.setItem('devmind-projects', JSON.stringify(projects));
  }, [projects]);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === projectId) ?? projects[0],
    [projectId, projects]
  );

  const fileEntries = selectedProject?.files ?? [];
  const selectedFileEntry = fileEntries.find((file) => file.path === selectedFile) ?? fileEntries[0];

  const updateSelectedProjectFile = (content: string) => {
    if (!selectedProject) return;

    setProjects((current) =>
      current.map((project) =>
        project.id === projectId
          ? {
              ...project,
              files: project.files.map((file) =>
                file.path === selectedFile ? { ...file, content, status: 'modified' } : file
              )
            }
          : project
      )
    );
  };

  const handleCreateProject = () => {
    const name = prompt('Project name', 'new-service');
    if (!name) return;

    const newProject: Project = {
      id: name.toLowerCase().replace(/\s+/g, '-'),
      name: name.replace(/-/g, ' '),
      template: 'Full-stack web app',
      summary: 'New project created from natural-language requirements.',
      status: 'Draft',
      lastUpdated: 'Just now',
      files: [
        {
          id: 'src/main.ts',
          path: 'src/main.ts',
          language: 'typescript',
          content: `export const appName = '${name}';\nconsole.log(appName);\n`,
          status: 'clean'
        },
        { id: 'README.md', path: 'README.md', language: 'markdown', content: '# Setup\n\nAdd project instructions here.\n', status: 'clean' }
      ]
    };

    setProjects((current) => [newProject, ...current]);
    setProjectId(newProject.id);
    setSelectedFile(newProject.files[0].path);
  };

  const handleSendPrompt = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      text: input,
      time: 'now'
    };

    setMessages((current) => [...current, userMessage]);
    setInput('');

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: input, projectId })
      });

      const data = await response.json();
      const text = data.reply || data.fallback?.message || 'The AI service is not ready yet. Configure credentials to enable live generation.';

      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          text,
          time: 'now'
        }
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: 'The AI boundary is unavailable right now. Add server-side credentials or use the local planning fallback.',
          time: 'now'
        }
      ]);
    }
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100">
      <aside className={`border-r border-slate-800 bg-slate-950/80 backdrop-blur ${sidebarOpen ? 'w-72' : 'w-20'} transition-all duration-200`}>
        <div className="flex items-center justify-between border-b border-slate-800 p-4">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 shadow-lg shadow-blue-500/20">
              <Sparkles className="h-5 w-5" />
            </div>
            {sidebarOpen && (
              <div>
                <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">DevMind</div>
                <div className="text-base font-bold text-white">AI</div>
              </div>
            )}
          </div>
          <button
            className="rounded-lg border border-slate-700 p-2 text-slate-300 hover:border-slate-500 hover:text-white"
            onClick={() => setSidebarOpen((value) => !value)}
            aria-label="Toggle sidebar"
          >
            {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
          </button>
        </div>

        <nav className="space-y-1 p-3">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${
                activeTab === tab
                  ? 'bg-blue-500/15 text-blue-200 ring-1 ring-blue-500/30'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              {tab === 'Dashboard' && <LayoutDashboard className="h-4 w-4" />}
              {tab === 'Projects' && <FolderOpen className="h-4 w-4" />}
              {tab === 'AI Engineer' && <Bot className="h-4 w-4" />}
              {tab === 'Code Review' && <ShieldCheck className="h-4 w-4" />}
              {tab === 'Testing' && <TestTube2 className="h-4 w-4" />}
              {tab === 'Model Settings' && <Settings className="h-4 w-4" />}
              {tab === 'Usage' && <Activity className="h-4 w-4" />}
              {tab === 'Account Settings' && <Users className="h-4 w-4" />}
              {sidebarOpen && <span>{tab}</span>}
            </button>
          ))}
        </nav>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b border-slate-800 bg-slate-950/80 px-6 py-4 backdrop-blur">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Engineering workspace</div>
            <div className="mt-1 text-xl font-semibold text-white">{selectedProject?.name ?? 'New project'}</div>
          </div>
          <div className="flex items-center gap-3">
            <button className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 hover:border-slate-600">Deploy</button>
            <button className="rounded-lg bg-blue-500 px-3 py-2 text-sm font-medium text-white hover:bg-blue-400" onClick={handleCreateProject}>New Project</button>
          </div>
        </header>

        <div className="flex flex-1 flex-col overflow-hidden">
          <section className="flex flex-wrap items-center gap-3 border-b border-slate-800 bg-slate-900/60 px-6 py-4 text-sm text-slate-300">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-emerald-300">
              <CheckCircle2 className="h-4 w-4" />
              67% issue coverage
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/40 bg-violet-500/10 px-3 py-1 text-violet-300">
              <Zap className="h-4 w-4" />
              3 active tasks
            </div>
            <div className="ml-auto flex items-center gap-2 rounded-full bg-slate-800 px-3 py-1.5 text-slate-300">
              <Database className="h-4 w-4 text-blue-300" />
              Supabase sync ready
            </div>
          </section>

          {activeTab === 'Dashboard' && (
            <div className="grid flex-1 grid-cols-12 gap-4 overflow-hidden p-6">
              <div className="col-span-12 xl:col-span-8 space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  {[
                    { label: 'Projects', value: '12', detail: '+2 this month', icon: FolderCog },
                    { label: 'AI sessions', value: '48', detail: '9 active', icon: MessageSquareText },
                    { label: 'Usage', value: '84%', detail: 'budget healthy', icon: Activity }
                  ].map(({ label, value, detail, icon: Icon }) => (
                    <div key={label} className="rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-lg shadow-slate-950/20">
                      <div className="mb-4 flex items-center justify-between">
                        <span className="text-slate-400">{label}</span>
                        <Icon className="h-4 w-4 text-blue-300" />
                      </div>
                      <div className="text-3xl font-bold text-white">{value}</div>
                      <div className="mt-2 text-sm text-slate-400">{detail}</div>
                    </div>
                  ))}
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <div className="text-sm uppercase tracking-[0.2em] text-slate-400">Recent projects</div>
                      <div className="mt-1 text-xl font-semibold text-white">Your active work</div>
                    </div>
                    <button className="text-sm text-blue-300 hover:text-blue-200">View all</button>
                  </div>
                  <div className="space-y-3">
                    {projects.map((project) => (
                      <button
                        key={project.id}
                        className="flex w-full items-center justify-between rounded-xl border border-slate-800 bg-slate-950/50 p-3 text-left hover:border-blue-500/40"
                        onClick={() => {
                          setProjectId(project.id);
                          setSelectedFile(project.files[0]?.path ?? '');
                        }}
                      >
                        <div>
                          <div className="font-medium text-white">{project.name}</div>
                          <div className="mt-1 text-sm text-slate-400">{project.template} • {project.lastUpdated}</div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="rounded-full border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-300">{project.status}</span>
                          <ChevronRight className="h-4 w-4 text-slate-500" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="col-span-12 xl:col-span-4 space-y-4">
                <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                  <div className="flex items-center justify-between">
                    <div className="text-sm uppercase tracking-[0.2em] text-slate-400">AI activity</div>
                    <Bot className="h-4 w-4 text-violet-300" />
                  </div>
                  <div className="mt-4 space-y-4">
                    {[
                      { label: 'Generated patch', value: '2 files', detail: 'Refactor plan accepted' },
                      { label: 'Busts in review', value: '3', detail: 'Root cause identified' },
                      { label: 'Test runs', value: '9', detail: '3 failed, 6 passed' }
                    ].map((item) => (
                      <div key={item.label} className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
                        <div className="text-sm text-slate-400">{item.label}</div>
                        <div className="mt-1 text-2xl font-bold text-white">{item.value}</div>
                        <div className="mt-1 text-xs text-slate-500">{item.detail}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                  <div className="mb-4 text-sm uppercase tracking-[0.2em] text-slate-400">Project health</div>
                  <div className="space-y-3">
                    {[
                      ['Build', '98%'],
                      ['Review', '88%'],
                      ['Security', '94%']
                    ].map(([label, percent]) => (
                      <div key={label}>
                        <div className="mb-2 flex justify-between text-sm text-slate-300">
                          <span>{label}</span>
                          <span>{percent}</span>
                        </div>
                        <div className="h-2.5 overflow-hidden rounded-full bg-slate-800">
                          <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-violet-500" style={{ width: percent }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab !== 'Dashboard' && (
            <div className="grid flex-1 grid-cols-12 gap-4 overflow-hidden p-4">
              <div className="col-span-12 xl:col-span-3 rounded-2xl border border-slate-800 bg-slate-900 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-sm uppercase tracking-[0.2em] text-slate-400">Files</div>
                  <button className="rounded-lg border border-slate-700 p-2 text-slate-300 hover:border-slate-500">+ New</button>
                </div>
                <div className="space-y-2">
                  {fileEntries.map((file) => (
                    <button
                      key={file.path}
                      onClick={() => setSelectedFile(file.path)}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm ${
                        selectedFile === file.path ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800/80'
                      }`}
                    >
                      <span className="truncate">{file.path}</span>
                      <span className={`h-2.5 w-2.5 rounded-full ${file.status === 'modified' ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                    </button>
                  ))}
                </div>
              </div>

              <div className="col-span-12 xl:col-span-6 flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
                <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
                  <div className="flex items-center gap-2 text-sm text-slate-300">
                    <Code2 className="h-4 w-4 text-blue-300" />
                    {selectedFileEntry?.path ?? 'No file selected'}
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-300">Format</button>
                    <button className="rounded-lg bg-blue-500 px-2 py-1 text-xs font-medium text-white">Review patch</button>
                  </div>
                </div>

                <div className="min-h-0 flex-1">
                  {selectedFileEntry ? (
                    <Editor
                      height="100%"
                      theme="vs-dark"
                      language={selectedFileEntry.language}
                      value={selectedFileEntry.content}
                      onChange={(value) => updateSelectedProjectFile(value ?? '')}
                      options={{
                        minimap: { enabled: false },
                        fontSize: 13,
                        wordWrap: 'on',
                        padding: { top: 16, bottom: 16 },
                        scrollbar: { verticalScrollbarSize: 10 }
                      }}
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-slate-400">No file is selected.</div>
                  )}
                </div>
              </div>

              <div className="col-span-12 xl:col-span-3 space-y-4">
                <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="text-sm uppercase tracking-[0.2em] text-slate-400">AI chat</div>
                    <MessageSquareText className="h-4 w-4 text-violet-300" />
                  </div>
                  <div className="space-y-3">
                    {messages.map((msg) => (
                      <div key={msg.id} className={`rounded-xl border p-3 text-sm ${msg.role === 'user' ? 'border-blue-500/20 bg-blue-500/5 text-blue-100' : 'border-slate-700 bg-slate-950/50 text-slate-300'}`}>
                        <div className="mb-1 text-xs uppercase tracking-[0.15em] text-slate-400">{msg.role}</div>
                        <div>{msg.text}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <input
                      value={input}
                      onChange={(event) => setInput(event.target.value)}
                      className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none ring-0 placeholder:text-slate-500 focus:border-blue-500"
                      placeholder="Ask the agent..."
                    />
                    <button onClick={handleSendPrompt} className="rounded-lg bg-violet-500 px-3 py-2 text-sm font-medium text-white hover:bg-violet-400">Send</button>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="text-sm uppercase tracking-[0.2em] text-slate-400">Terminal</div>
                    <TerminalSquare className="h-4 w-4 text-emerald-300" />
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 font-mono text-xs text-slate-200">
                    {terminalLog.map((entry) => (
                      <div key={entry} className="py-1">{entry}</div>
                    ))}
                  </div>
                  <button className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:border-slate-500" onClick={() => setTerminalLog((current) => [...current, '$ npm run build', '✓ build completed'])}>
                    <Play className="h-4 w-4" />
                    Run checks
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
