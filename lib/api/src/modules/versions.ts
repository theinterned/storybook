import { VERSIONCHECK } from 'global';
import semver from 'semver';
import memoize from 'memoizerific';

import { version as currentVersion } from '../version';

import { Module, API } from '../index';

export interface Version {
  version: string;
  info?: { plain: string };
  [key: string]: any;
}

export interface UnknownEntries {
  [key: string]: {
    [key: string]: any;
  };
}

export interface Versions {
  latest?: Version;
  next?: Version;
  current?: Version;
}

export interface SubState {
  versions: Versions & UnknownEntries;
  lastVersionCheck: number;
  dismissedVersionNotification: undefined | string;
}

const getVersionCheckData = memoize(1)(
  (): Versions => {
    try {
      return { ...(JSON.parse(VERSIONCHECK).data || {}) };
    } catch (e) {
      return {};
    }
  }
);

export interface SubAPI {
  getCurrentVersion: () => Version;
  getLatestVersion: () => Version;
  versionUpdateAvailable: () => boolean;
}

export default function({ store, mode }: Module) {
  const { dismissedVersionNotification } = store.getState();

  const state = {
    versions: {
      current: {
        version: currentVersion,
      },
      ...getVersionCheckData(),
    },
    dismissedVersionNotification,
  };

  const api: SubAPI = {
    getCurrentVersion: () => {
      const {
        versions: { current },
      } = store.getState();
      return current;
    },
    getLatestVersion: () => {
      const {
        versions: { latest, next, current },
      } = store.getState();
      if (current && semver.prerelease(current.version) && next) {
        return latest && semver.gt(latest.version, next.version) ? latest : next;
      }
      return latest;
    },
    versionUpdateAvailable: () => {
      const latest = api.getLatestVersion();
      const current = api.getCurrentVersion();

      if (latest) {
        if (!latest.version) {
          return true;
        }
        if (!current.version) {
          return true;
        }

        const onPrerelease = !!semver.prerelease(current.version);

        const actualCurrent = onPrerelease
          ? `${semver.major(current.version)}.${semver.minor(current.version)}.${semver.patch(
              current.version
            )}`
          : current.version;

        const diff = semver.diff(actualCurrent, latest.version);

        return (
          semver.gt(latest.version, actualCurrent) && diff !== 'patch' && !diff.includes('pre')
        );
      }
      return false;
    },
  };

  // Grab versions from the server/local storage right away
  async function init({ api: fullApi }: API) {
    const { versions = {} } = store.getState();

    const { latest, next } = getVersionCheckData();
    await store.setState({
      versions: { ...versions, latest, next },
    });

    if (api.versionUpdateAvailable()) {
      const latestVersion = api.getLatestVersion().version;

      const diff = semver.diff(versions.current.version, versions.latest.version);

      if (
        latestVersion !== dismissedVersionNotification &&
        diff !== 'patch' &&
        !semver.prerelease(latestVersion) &&
        mode !== 'production'
      ) {
        fullApi.addNotification({
          id: 'update',
          link: '/settings/about',
          content: `🎉 Storybook ${latestVersion} is available!`,
          onClear() {
            store.setState(
              { dismissedVersionNotification: latestVersion },
              { persistence: 'permanent' }
            );
          },
        });
      }
    }
  }

  return { init, state, api };
}
