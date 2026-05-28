const { spawn, spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const projectAliases = new Map([
  ['nest', '@gavai/nest'],
  ['web', '@gavai/web'],
  ['sidecar', 'sidecar'],
]);

const splitProjects = (value) =>
  value
    .split(/[,\s]+/)
    .map((project) => project.trim())
    .filter(Boolean);

const normalizeProject = (project) => {
  if (project.startsWith('!')) {
    const unprefixedProject = project.slice(1);
    return `!${projectAliases.get(unprefixedProject) ?? unprefixedProject}`;
  }

  if (
    project.includes('*') ||
    project.startsWith('tag:') ||
    project.startsWith('@')
  ) {
    return project;
  }

  return projectAliases.get(project) ?? project;
};

const normalizeProjectsArg = (args) => {
  const normalizedArgs = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg.startsWith('--projects=')) {
      const projects = splitProjects(arg.slice('--projects='.length))
        .map(normalizeProject)
        .join(',');

      normalizedArgs.push(`--projects=${projects}`);
      continue;
    }

    if (arg === '--projects') {
      const projectArgs = [];

      while (args[index + 1] && !args[index + 1].startsWith('-')) {
        projectArgs.push(args[index + 1]);
        index += 1;
      }

      const projects = splitProjects(projectArgs.join(' '))
        .map(normalizeProject)
        .join(',');

      normalizedArgs.push(`--projects=${projects}`);
      continue;
    }

    normalizedArgs.push(arg);
  }

  return normalizedArgs;
};

const resolvePnpmInvocation = () => {
  for (const directory of (process.env.PATH ?? '').split(path.delimiter)) {
    const pnpmEntrypoint = path.join(
      directory,
      'node_modules',
      'pnpm',
      'bin',
      'pnpm.mjs',
    );

    if (fs.existsSync(pnpmEntrypoint)) {
      return {
        command: process.execPath,
        argsPrefix: [pnpmEntrypoint],
      };
    }
  }

  return {
    command: process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
    argsPrefix: [],
  };
};

const pnpm = resolvePnpmInvocation();

const runPnpmSync = (args, options) =>
  spawnSync(pnpm.command, [...pnpm.argsPrefix, ...args], options);

const runPnpm = (args, options) =>
  spawn(pnpm.command, [...pnpm.argsPrefix, ...args], options);

const nxArgs = [
  'exec',
  'nx',
  'run-many',
  '--target=serve',
  '--parallel=true',
  ...normalizeProjectsArg(process.argv.slice(2)),
];

if (nxArgs.findIndex((a) => a.startsWith('--projects=')) === -1) {
  nxArgs.push('--projects=@gavai/nest,@gavai/web,sidecar');
}

const nx = runPnpm(nxArgs, { stdio: 'inherit' });

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    nx.kill(signal);
  });
}

nx.on('exit', (code, signal) => {
  if (signal) {
    process.exit(signal === 'SIGINT' ? 130 : 1);
    return;
  }

  process.exit(code ?? 1);
});
