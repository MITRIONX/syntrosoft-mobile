import { Alert, Linking } from 'react-native'
import Constants from 'expo-constants'

const GITHUB_REPO = 'MITRIONX/syntrosoft-mobile'
const GITHUB_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`

interface GithubRelease {
  tag_name: string
  name: string
  body: string
  assets: { name: string; browser_download_url: string }[]
}

function parseVersion(tag: string): number[] {
  return tag.replace(/^v/, '').split('.').map(Number)
}

function isNewer(remote: string, local: string): boolean {
  const r = parseVersion(remote)
  const l = parseVersion(local)
  for (let i = 0; i < 3; i++) {
    if ((r[i] || 0) > (l[i] || 0)) return true
    if ((r[i] || 0) < (l[i] || 0)) return false
  }
  return false
}

export async function checkForUpdate(): Promise<void> {
  try {
    const currentVersion = Constants.expoConfig?.version || '0.0.0'

    const res = await fetch(GITHUB_API, {
      headers: { 'Accept': 'application/vnd.github.v3+json' },
    })

    if (!res.ok) return

    const release: GithubRelease = await res.json()
    const remoteVersion = release.tag_name

    if (!isNewer(remoteVersion, currentVersion)) return

    const apkAsset = release.assets.find(a => a.name.endsWith('.apk'))
    if (!apkAsset) return

    Alert.alert(
      `Update verfuegbar`,
      `Version ${remoteVersion} ist verfuegbar (aktuell: v${currentVersion}).\n\n${release.body?.split('\n').slice(0, 5).join('\n') || ''}`,
      [
        { text: 'Spaeter', style: 'cancel' },
        {
          text: 'Jetzt updaten',
          onPress: () => Linking.openURL(apkAsset.browser_download_url),
        },
      ]
    )
  } catch {
    // Kein Internet oder API-Fehler - still ignorieren
  }
}
