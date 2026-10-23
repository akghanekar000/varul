import { useEffect, useMemo, useState } from 'react';
import Editor from '@monaco-editor/react';
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronRight,
  Code2,
  Database,
  FileText,
  FolderOpen,
  GitBranch,
  LayoutDashboard,
  MessageSquareText,
  Play,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  TestTube2,
  Trash2,
  Users,
  Zap,
  PencilLine,
  FolderCog,
  PanelLeftClose,
  PanelLeftOpen
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

type ProjectStatus = 'Draft' | 'Active' | 'Deploy-ready' | 'Needs review';

type FileNode = {
  id: string;
  path: string;
  language: string;
  content: string;
  status: 'clean' | 'modified' | 'new';
};

type Project = {
  id: string;
  name: string;
  template: string;
  summary: string;
  status: ProjectStatus;
  lastUpdated: string;
  files: FileNode[];
};

type Message = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  time: string;
};

type ProviderMeta = {
  name: string;
  key: string;
  enabled: boolean;
};

type ProviderState = {
  providers: ProviderMeta[];
  defaultProvider: string;
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

const defaultProjectFiles: FileNode[] = [
  {
    id: 'src/App.tsx',
    path: 'src/App.tsx',
    language: 'typescript',
    content: `export default function App() {\n  return (\n    <main className="min-h-screen bg-slate-950 p-8 text-white">\n      <h1 className="text-3xl font-bold">Welcome to DevMind</h1>\n      <p className="mt-3 text-slate-300">AI software engineering workspace</p>\n    </main>\n  );\n}\n`,
    status: 'clean'
  },
  {
    id: 'README.md',
    path: 'README.md',
    language: 'markdown',
    content: '# DevMind AI\n\nAI-powered software engineering workspace.\n',
    status: 'clean'
  }
];

const initialProjects: Project[] = [
  {
    id: 'acme-portal',
    name: 'Acme Portal',
    template: 'React + TypeScript',
    summary: 'Customer portal with dashboards, billing, workflow automations, and support data.',
    status: 'Active',
    lastUpdated: '2 hours ago',
    files: [
      ...defaultProjectFiles,
      {
        id: 'src/lib/metrics.ts',
        path: 'src/lib/metrics.ts',
        language: 'typescript',
        content: 'export const revenueTarget = 2400000;\nexport const currentRunRate = 1985000;\n',
        status: 'modified'
      }
    ]
  },
  {
    id: 'billing-api',
    name: 'Billing API',
    template: 'REST API',
    summary: 'Secure service for invoicing, payment retries, webhooks, and billing audit events.',
    status: 'Deploy-ready',
    lastUpdated: 'Today',
    files: [
      {
        id: 'src/server.ts',
        path: 'src/server.ts',
        language: 'typescript',
        content: "import express from 'express';\n\nconst app = express();\n\napp.get('/health', (_req, res) => res.json({ ok: true }));\n\napp.listen(3000, () => console.log('billing api ready'));\n",
        status: 'clean'
      },
      {
        id: 'tests/invoice.test.ts',
        path: 'tests/invoice.test.ts',
        language: 'typescript',
        content: "describe('invoice service', () => {\n  it('creates invoice payload', () => {\n    expect(true).toBe(true);\n  });\n});\n",
        status: 'modified'
      }
    ]
  }
];

const emptyMessage: Message = {
  id: 'empty-msg',
  role: 'assistant',
  text: 'I can review the project, suggest a plan, inspect files, and propose a bounded fix. Ask me about requirements, architecture, bugs, or tests.',
  time: 'now'
};

function detectLanguage(path: string) {
  if (path.endsWith('.tsx')) return 'typescript';
  if (path.endsWith('.ts')) return 'typescript';
  if (path.endsWith('.json')) return 'json';
  if (path.endsWith('.md')) return 'markdown';
  if (path.endsWith('.css')) return 'css';
  if (path.endsWith('.sql')) return 'sql';
  if (path.endsWith('.yaml') || path.endsWith('.yml')) return 'yaml';
  return 'plaintext';
}

function getDefaultContent(path: string) {
  if (path.endsWith('.tsx')) {
    return "export default function Component() {\n  return <section className='p-6'>DevMind component</section>;\n}\n";
  }
  if (path.endsWith('.ts')) {
    return "export const value = 'ready';\n";
  }
  if (path.endsWith('.md')) {
    return '# Project\n\nAdd notes here.\n';
  }
  if (path.endsWith('.json')) {
    return '{\n  "name": "devmind-ai"\n}\n';
  }
  return '';
}

function readProjects() {
  if (typeof window === 'undefined') {
    return initialProjects;
  }

  const cached = window.localStorage.getItem('devmind-projects');
  if (!cached) return initialProjects;

  try {
    const data = JSON.parse(cached) as Project[];
    return data.length ? data : initialProjects;
  } catch {
    return initialProjects;
  }
}

function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('Dashboard');
  const [projects, setProjects] = useState<Project[]>(() => readProjects());
  const [selectedProjectId, setSelectedProjectId] = useState<string>(initialProjects[0].id);
  const [selectedFile, setSelectedFile] = useState<string>('src/App.tsx');
  const [messages, setMessages] = useState<Message[]>([emptyMessage]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [providerState, setProviderState] = useState<ProviderState>({ providers: [], defaultProvider: 'openai' });
  const [terminalLog, setTerminalLog] = useState<string[]>([
    '$ npm run build',
    'No command was executed in this environment. The project is configured for local execution when a sandbox is available.'
  ]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('devmind-projects', JSON.stringify(projects));
    }
  }, [projects]);

  useEffect(() => {
    fetch('/api/models')
      .then((response) => response.json())
      .then((data) => setProviderState(data))
      .catch(() => setProviderState({ providers: [], defaultProvider: 'openai' }));
  }, []);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? projects[0],
    [projects, selectedProjectId]
  );

  const fileEntries = selectedProject?.files ?? [];
  const selectedFileEntry = fileEntries.find((file) => file.path === selectedFile) ?? fileEntries[0];

  const updateProjectFile = (path: string, content: string) => {
    if (!selectedProject) return;
    setProjects((current) =>
      current.map((project) =>
        project.id === selectedProject.id
          ? {
              ...project,
              files: project.files.map((file) =>
                file.path === path ? { ...file, content, status: file.status === 'new' ? 'new' : 'modified' } : file
              )
            }
          : project
      )
    );
  };

  const addNewFile = () => {
    const userPath = window.prompt('File path', 'src/new-feature.ts');
    if (!userPath) return;
    const normalized = userPath.trim();
    const newFile: FileNode = {
      id: normalized,
      path: normalized,
      language: detectLanguage(normalized),
      content: getDefaultContent(normalized),
      status: 'new'
    };

    setProjects((current) =>
      current.map((project) =>
        project.id === selectedProjectId
          ? { ...project, files: [...project.files, newFile], lastUpdated: 'Just now' }
          : project
      )
    );
    setSelectedFile(normalized);
  };

  const renameCurrentFile = () => {
    if (!selectedFileEntry) return;
    const nextPath = window.prompt('Rename file', selectedFileEntry.path);
    if (!nextPath) return;
    const trimmed = nextPath.trim();
    setProjects((current) =>
      current.map((project) => {
        if (project.id !== selectedProjectId) return project;
        return {
          ...project,
          files: project.files.map((file) =>
            file.id === selectedFileEntry.id ? { ...file, path: trimmed, language: detectLanguage(trimmed), id: trimmed, status: 'modified' } : file
          ),
          lastUpdated: 'Just now'
        };
      })
    );
    setSelectedFile(trimmed);
  };

  const deleteCurrentFile = () => {
    if (!selectedFileEntry) return;
    const confirmed = window.confirm(`Delete ${selectedFileEntry.path}?`);
    if (!confirmed) return;
    setProjects((current) =>
      current.map((project) =>
        project.id === selectedProjectId
          ? {
              ...project,
              files: project.files.filter((file) => file.id !== selectedFileEntry.id),
              lastUpdated: 'Just now'
            }
          : project
      )
    );
    const fallback = (selectedProject?.files ?? []).find((file) => file.id !== selectedFileEntry.id)?.path ?? '';
    setSelectedFile(fallback);
  };

  const handleCreateProject = () => {
    const name = window.prompt('Project name', 'new-service');
    if (!name) return;
    const projectId = name.toLowerCase().replace(/\s+/g, '-');
    const project: Project = {
      id: projectId,
      name: name.trim(),
      template: 'Full-stack web app',
      summary: 'New project created from a natural-language requirement.',
      status: 'Draft',
      lastUpdated: 'Just now',
      files: [
        {
          id: 'src/main.ts',
          path: 'src/main.ts',
          language: 'typescript',
          content: `export const projectName = '${name.trim()}';\nconsole.log(projectName);\n`,
          status: 'clean'
        },
        {
          id: 'README.md',
          path: 'README.md',
          language: 'markdown',
          content: `# ${name.trim()}\n\nProject created with DevMind AI.\n`,
          status: 'clean'
        }
      ]
    };

    setProjects((current) => [project, ...current]);
    setSelectedProjectId(project.id);
    setSelectedFile(project.files[0].path);
    setActiveTab('AI Engineer');
  };

  const handleSendPrompt = async () => {
    const trimmed = input.trim();
    if (!trimmed || isSending) return;

    setIsSending(true);
    const userMessage: Message = { id: crypto.randomUUID(), role: 'user', text: trimmed, time: 'now' };
    setMessages((current) => [...current, userMessage]);
    setInput('');

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, projectId: selectedProjectId })
      });
      const data = await response.json();
      const text = data.reply || data.fallback?.message || 'The AI service is not configured yet. Add server-side provider credentials to enable live model access.';
      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: 'assistant', text, time: 'now' }
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: 'assistant', text: 'The AI boundary is unavailable. Configure server-side credentials or continue in local planning mode.', time: 'now' }
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handleRunChecks = () => {
    setTerminalLog((current) => [
      ...current,
      '$ npm run test',
      'Build and test execution were not run in this environment. Configure a sandboxed execution backend to run isolated checks.'
    ]);
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
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">DevMind</div>
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
              type="button"
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
            <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Engineering workspace</div>
            <div className="mt-1 text-xl font-semibold text-white">{selectedProject?.name ?? 'New project'}</div>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 hover:border-slate-600">
              Deploy
            </button>
            <button type="button" className="rounded-lg bg-blue-500 px-3 py-2 text-sm font-medium text-white hover:bg-blue-400" onClick={handleCreateProject}>
              New Project
            </button>
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
              {providerState.providers.length ? 'Provider configured' : 'Provider setup required'}
            </div>
          </section>

          {activeTab === 'Dashboard' && (
            <div className="grid flex-1 grid-cols-12 gap-4 overflow-hidden p-6">
              <div className="col-span-12 xl:col-span-8 space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  {[
                    { label: 'Projects', value: String(projects.length), detail: 'Owned and active', icon: FolderCog },
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
                    <button type="button" className="text-sm text-blue-300 hover:text-blue-200">View all</button>
                  </div>
                  <div className="space-y-3">
                    {projects.map((project) => (
                      <button
                        key={project.id}
                        type="button"
                        className="flex w-full items-center justify-between rounded-xl border border-slate-800 bg-slate-950/50 p-3 text-left hover:border-blue-500/40"
                        onClick={() => {
                          setSelectedProjectId(project.id);
                          setSelectedFile(project.files[0]?.path ?? '');
                          setActiveTab('AI Engineer');
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
                      { label: 'Bugs in review', value: '3', detail: 'Root cause identified' },
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

          {activeTab === 'Projects' && (
            <div className="grid flex-1 grid-cols-12 gap-4 overflow-hidden p-6">
              <div className="col-span-12 lg:col-span-8 space-y-4">
                {projects.map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => {
                      setSelectedProjectId(project.id);
                      setSelectedFile(project.files[0]?.path ?? '');
                      setActiveTab('AI Engineer');
                    }}
                    className="flex w-full items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 p-5 text-left shadow-lg shadow-slate-950/20"
                  >
                    <div>
                      <div className="text-lg font-semibold text-white">{project.name}</div>
                      <div className="mt-2 max-w-xl text-sm text-slate-400">{project.summary}</div>
                    </div>
                    <div className="text-right">
                      <div className="rounded-full border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-300">{project.status}</div>
                      <div className="mt-2 text-xs text-slate-500">{project.lastUpdated}</div>
                    </div>
                  </button>
                ))}
              </div>

              <div className="col-span-12 lg:col-span-4 rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div className="text-sm uppercase tracking-[0.2em] text-slate-400">Tools</div>
                  <FolderCog className="h-4 w-4 text-blue-300" />
                </div>
                <div className="space-y-2 text-sm text-slate-300">
                  <button type="button" className="flex w-full items-center justify-between rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" onClick={handleCreateProject}>
                    <span>Create project</span>
                    <Plus className="h-4 w-4" />
                  </button>
                  <button type="button" className="flex w-full items-center justify-between rounded-lg border border-slate-700 bg-slate-950 px-3 py-2">
                    <span>Clone repository</span>
                    <GitBranch className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {(activeTab === 'AI Engineer' || activeTab === 'Code Review' || activeTab === 'Testing' || activeTab === 'Model Settings' || activeTab === 'Usage' || activeTab === 'Account Settings') && (
            <div className="grid flex-1 grid-cols-12 gap-4 overflow-hidden p-4">
              <div className="col-span-12 xl:col-span-3 rounded-2xl border border-slate-800 bg-slate-900 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-sm uppercase tracking-[0.2em] text-slate-400">Files</div>
                  <button type="button" className="rounded-lg border border-slate-700 p-2 text-slate-300 hover:border-slate-500" onClick={addNewFile}>
                    + New
                  </button>
                </div>
                <div className="space-y-2">
                  {fileEntries.map((file) => (
                    <button
                      key={file.path}
                      type="button"
                      onClick={() => setSelectedFile(file.path)}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm ${
                        selectedFile === file.path ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800/80'
                      }`}
                    >
                      <span className="truncate">{file.path}</span>
                      <span className={`h-2.5 w-2.5 rounded-full ${file.status === 'modified' ? 'bg-amber-400' : file.status === 'new' ? 'bg-blue-400' : 'bg-emerald-400'}`} />
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
                    <button type="button" className="rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-300" onClick={renameCurrentFile}>
                      <span className="inline-flex items-center gap-1"><PencilLine className="h-3.5 w-3.5" />Rename</span>
                    </button>
                    <button type="button" className="rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-300" onClick={deleteCurrentFile}>
                      <span className="inline-flex items-center gap-1"><Trash2 className="h-3.5 w-3.5" />Delete</span>
                    </button>
                  </div>
                </div>

                <div className="min-h-0 flex-1">
                  {selectedFileEntry ? (
                    <Editor
                      height="100%"
                      theme="vs-dark"
                      language={selectedFileEntry.language}
                      value={selectedFileEntry.content}
                      onChange={(value) => updateProjectFile(selectedFileEntry.path, value ?? '')}
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
                        <div className="mb-1 text-[10px] uppercase tracking-[0.15em] text-slate-400">{msg.role}</div>
                        <div>{msg.text}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <input
                      value={input}
                      onChange={(event) => setInput(event.target.value)}
                      className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-blue-500"
                      placeholder="Ask the agent..."
                    />
                    <button type="button" disabled={isSending} onClick={handleSendPrompt} className="rounded-lg bg-violet-500 px-3 py-2 text-sm font-medium text-white hover:bg-violet-400 disabled:cursor-not-allowed disabled:bg-violet-700">
                      {isSending ? '...' : 'Send'}
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="text-sm uppercase tracking-[0.2em] text-slate-400">Terminal</div>
                    <TerminalSquare className="h-4 w-4 text-emerald-300" />
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 font-mono text-xs text-slate-200">
                    {terminalLog.map((entry) => (
                      <div key={`${entry}-${Math.random()}`} className="py-1">{entry}</div>
                    ))}
                  </div>
                  <button type="button" className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:border-slate-500" onClick={handleRunChecks}>
                    <Play className="h-4 w-4" />
                    Run checks
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Code Review' && (
            <div className="grid flex-1 grid-cols-12 gap-4 overflow-hidden p-6">
              <div className="col-span-12 xl:col-span-6 rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <div className="mb-4 flex items-center gap-2 text-sm uppercase tracking-[0.2em] text-slate-400">
                  <ShieldCheck className="h-4 w-4 text-blue-300" />
                  Review findings
                </div>
                <div className="space-y-3 text-sm text-slate-300">
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
                    <div className="flex items-center gap-2 font-medium text-amber-200"><AlertTriangle className="h-4 w-4" />High risk: unvalidated input path</div>
                    <div className="mt-1 text-slate-400">Need to validate file creation and deletion paths before mutating project files.</div>
                  </div>
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
                    <div className="flex items-center gap-2 font-medium text-emerald-200"><CheckCircle2 className="h-4 w-4" />Good: server-side secret handling</div>
                    <div className="mt-1 text-slate-400">All provider credentials remain server-side and are not shipped to the browser bundle.</div>
                  </div>
                </div>
              </div>

              <div className="col-span-12 xl:col-span-6 rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <div className="mb-4 flex items-center gap-2 text-sm uppercase tracking-[0.2em] text-slate-400">
                  <FileText className="h-4 w-4 text-violet-300" />
                  Diff preview
                </div>
                <pre className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs text-slate-200">
{`--- a/src/App.tsx
+++ b/src/App.tsx
@@
- export default function App() {
+ export default function App() {
+   return <div>DevMind AI</div>;
 }
`}
                </pre>
              </div>
            </div>
          )}

          {activeTab === 'Testing' && (
            <div className="grid flex-1 grid-cols-12 gap-4 overflow-hidden p-6">
              <div className="col-span-12 xl:col-span-6 rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <div className="mb-4 flex items-center gap-2 text-sm uppercase tracking-[0.2em] text-slate-400">
                  <TestTube2 className="h-4 w-4 text-emerald-300" />
                  Automated checks
                </div>
                <div className="space-y-3 text-sm text-slate-300">
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">TypeScript: configured for Vite + React and server-side entry points.</div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">Vitest: smoke tests for AI config and planner response are included.</div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">Execution sandbox: requires a dedicated backend service before real shell commands can be run safely.</div>
                </div>
              </div>

              <div className="col-span-12 xl:col-span-6 rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <div className="mb-4 flex items-center gap-2 text-sm uppercase tracking-[0.2em] text-slate-400">
                  <Search className="h-4 w-4 text-violet-300" />
                  Problems
                </div>
                <div className="space-y-2 text-sm text-slate-300">
                  <div className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2">No compiler issue detected at app shell level.</div>
                  <div className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2">AI provider credentials are required to enable live model calls.</div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Model Settings' && (
            <div className="grid flex-1 grid-cols-12 gap-4 overflow-hidden p-6">
              <div className="col-span-12 xl:col-span-8 rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <div className="mb-4 flex items-center gap-2 text-sm uppercase tracking-[0.2em] text-slate-400">
                  <Settings className="h-4 w-4 text-blue-300" />
                  AI providers
                </div>
                <div className="space-y-3">
                  {providerState.providers.length ? (
                    providerState.providers.map((provider) => (
                      <div key={provider.key} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm text-slate-300">
                        <span className="font-medium text-white">{provider.name}</span>
                        <span className={`rounded-full px-2 py-1 text-xs ${provider.enabled ? 'bg-emerald-500/10 text-emerald-300' : 'bg-amber-500/10 text-amber-300'}`}>
                          {provider.enabled ? 'Configured' : 'Missing'}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 text-sm text-amber-100">
                      No provider credentials are currently configured. Add values to the server environment before enabling live AI requests.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Usage' && (
            <div className="grid flex-1 grid-cols-12 gap-4 overflow-hidden p-6">
              <div className="col-span-12 xl:col-span-6 rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <div className="mb-4 flex items-center gap-2 text-sm uppercase tracking-[0.2em] text-slate-400">
                  <Activity className="h-4 w-4 text-violet-300" />
                  Usage overview
                </div>
                <div className="space-y-4 text-sm text-slate-300">
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">Prompt tokens: 12,400</div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">Completion tokens: 4,250</div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">Estimated spend: $0.00 (provider keys not configured)</div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Account Settings' && (
            <div className="grid flex-1 grid-cols-12 gap-4 overflow-hidden p-6">
              <div className="col-span-12 xl:col-span-6 rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <div className="mb-4 flex items-center gap-2 text-sm uppercase tracking-[0.2em] text-slate-400">
                  <Users className="h-4 w-4 text-blue-300" />
                  Account profile
                </div>
                <div className="space-y-3 text-sm text-slate-300">
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">Email: team@devmind.ai</div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">Workspace: Default team</div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">Role: Engineering admin</div>
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
