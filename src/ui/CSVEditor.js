import ContextualIdentities from '../ContextualIdentity';
import State from '../State';
import Storage from '../Storage/HostStorage';
import {cleanHostInput, qs} from '../utils';
import {hideLoader, showLoader} from './loader';
import {hideToast, showToast} from './toast';

const HOST_MAPS_SPLIT_KEY = ',';
const csvEditor = qs('.csv-editor');
const openButton = qs('.ce-open-button');
const closeButton = qs('.ce-close-button');
const saveButton = qs('.ce-save-button');
const hostTextarea = qs('.ce-hosts-textarea');

class CSVEditor {

  constructor(state) {
    this.state = state;
    State.addListener(this.update.bind(this));
    openButton.addEventListener('click', this.showEditor.bind(this));
    closeButton.addEventListener('click', this.hideEditor.bind(this));
    saveButton.addEventListener('click', this.saveUrlMaps.bind(this));
    this.render();
  }

  update(newState) {
    this.state = newState;
    this.render();
  }

  render() {
    showLoader();

    if (!this.state.urlMaps || !this.state.identities) {
      return false;
    }

    let hostMaps = '';
    for (const key in this.state.urlMaps) {
      const urlMap = this.state.urlMaps[key];
      hostMaps += `${urlMap.host} ${HOST_MAPS_SPLIT_KEY} ${urlMap.containerName}\n`;
    }
    hostTextarea.value = hostMaps;

    hideLoader();
  }

  addIdentity(identity, host, maps) {
    maps[host] = {
      host,
      cookieStoreId: identity.cookieStoreId,
      containerName: identity.name,
      enabled: true,
    };
  }

  async createMissingContainers(missingContainers, maps) {
    for (const containerName of missingContainers.keys()) {
      const identity = await ContextualIdentities.create(containerName);
      for (const host of missingContainers.get(containerName)) {
        this.addIdentity(identity, host, maps);
      }
    }
  }

  async saveUrlMaps() {
    showLoader();
    const items = hostTextarea.value.trim().split('\n').filter(s => s.charAt(0) !== '#');
    const maps = {};
    const missingContainers = new Map();

    await Promise.all(items.map((item) => {
      const hostMapParts = item.split(HOST_MAPS_SPLIT_KEY);
      const host = cleanHostInput(hostMapParts.slice(0, -1).join(HOST_MAPS_SPLIT_KEY));
      const containerName = hostMapParts[hostMapParts.length - 1];
      let identity;

      if (host && containerName) {
        identity = this.state.identities.find((identity) => cleanHostInput(identity.name) === cleanHostInput(containerName));
        if (!identity) {
          const trimmedContainer = containerName.trim();
          if (!missingContainers.has(trimmedContainer)) {
            missingContainers.set(trimmedContainer, [host]);
          } else {
            missingContainers.get(trimmedContainer).push(host);
          }
        } else {
          this.addIdentity(identity, host, maps);
        }
      }
    }));

    await this.createMissingContainers(missingContainers, maps);

    await Storage.clear();
    await Storage.setAll(maps);

    hideLoader();
    showToast('Saved!');
    setTimeout(() => hideToast(), 3000);
  }

  showEditor() {
    csvEditor.classList.remove('hide');
  }

  hideEditor() {
    csvEditor.classList.add('hide');
  }

}

export default new CSVEditor({
  urlMaps: State.get('urlMaps'),
  identities: State.get('identities'),
});
