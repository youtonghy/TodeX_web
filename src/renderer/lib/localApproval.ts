/**
 * Web: a browser cannot run `docker exec` on the backend's host, so container
 * pairing requests are always approved by the user (the commands the pairing
 * panel shows). Desktop implements this. Resolves false: nothing was tried.
 */
export async function approveContainerPairing(_serverUrl: string, _verificationCode: string): Promise<boolean> {
  return false;
}
