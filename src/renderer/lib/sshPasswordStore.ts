// Saved SSH host passwords. The web client has no OS keychain, so it never
// keeps them: every password is typed for the connection that uses it. The
// desktop client implements this module with Electron safeStorage.

/** Whether this client can remember passwords at all (false on the web). */
export const sshPasswordsRememberable = false;

export async function canRememberSshPasswords(): Promise<boolean> {
  return false;
}

export async function loadSshPassword(_backendId: string, _alias: string): Promise<string | null> {
  return null;
}

/** Only forgetting is supported (a no-op, nothing is ever saved). */
export async function saveSshPassword(_backendId: string, _alias: string, password: string | null): Promise<void> {
  if (password !== null) throw new Error('SSH passwords cannot be saved in the browser');
}
