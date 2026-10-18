/** Sets or clears DB_READONLY for the command; an inherited value (shell, .env) must not leak into write commands. */
export function applyReadOnlyMode(env: NodeJS.ProcessEnv, command: { readOnly?: boolean }): void {
  if (command.readOnly) env.DB_READONLY = '1';
  else delete env.DB_READONLY;
}
