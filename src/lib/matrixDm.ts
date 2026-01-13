import client from './matrixClient'

export function isMatrixLoggedIn(): boolean {
  try {
    // Heuristique simple : si le client a un userId et a démarré
    return !!(client.getUserId?.() && (client as any).clientRunning)
  } catch {
    return false
  }
}

/*
Usage rapide :
(async () => {
  if (isMatrixLoggedIn()) {
    console.log('Matrix client actif, prêt pour les DM')
  }
})()
*/
