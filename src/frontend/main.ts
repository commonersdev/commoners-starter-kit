import { BleClient } from '@capacitor-community/bluetooth-le';


const list = document.querySelector('#commands') as HTMLUListElement



async function createClient(url: string | URL, id = '') {

  url = new URL('.commoners', url)
  
  const client = await new SwaggerClient(typeof url === 'string' ? url : url.href).catch((e: any) => {
    throw new Error(`Failed to create client for ${url}: ${e.message}`)
  })

  const nestedList = document.createElement('ul')
  nestedList.id = id
  list.appendChild(nestedList)


  const { title, description } = client.spec.info
  const section = document.createElement('section')
  section.innerHTML = `<h3>${title}</h3><small>${description}</small>`
  nestedList.append(section)

  // Populate list of available methods
  Object.keys(client.spec.paths).forEach((path: any) => {
    const info = client.spec.paths[path]

    const keys = Object.keys(info)
    keys.forEach((method: any) => {
      const { operationId, tags, description } = info[method]
      const li = document.createElement('li') 
      const container = document.createElement('div')     
      container.innerHTML = `${operationId ?? path}${keys.length > 1 ? ` (${method})` : ''}<br>${description ? `<small>${description}</small><br/>` : ''} <div class="tags">${tags.map(tag => `<div>${tag}</div>`)}</div>`

      const button = document.createElement('button')
      button.innerText = 'Run'
      button.onclick = async () => {
          const result = await client.apis[tags[0]][operationId]()
          onData({ source: title, command: operationId, payload: result.body })
      }

      li.append(container, button)
      nestedList.appendChild(li)
    })
  })

  return client
}

const messages = document.getElementById('messages') as HTMLElement

const display = (message: string) => {
  messages.innerHTML += `<div>${message}</div>`
  messages.scrollTop = messages.scrollHeight;
}

const onData = (data: any) => {
  if (data.error) return console.error(data.error)

  display(`${data.source ? `${data.source} (${data.command})` : data.command} - ${JSON.stringify(data.payload)}`)
}

// Remote API Tests (Basic Fetch Commands)
const remoteAPIs = {
  'Remote': commoners.services.remote,
  'Dynamic': commoners.services.dynamic
}


Object.entries(remoteAPIs).forEach(([label, service]) => {
    if (!service) return console.error(`Service ${label} is not available`)
    const url = new URL('/users', service.url)

    setTimeout(() => {
      fetch(url)
      .then(response => response.json())
      .then(json => onData({source: label, command: 'users', payload: json.length}))
      .catch(e => console.error('Failed to request from remote server', e))
    })

})




// --------- Node Service Test (WebSockets) ---------
const nodeServices = { 
  LocalNode: commoners.services.localNode, 
  DynamicNode: commoners.services.dynamicNode,
  Typescript: commoners.services.typescript, 
}

console.log(commoners)
Object.entries(nodeServices).forEach(([label, service]) => {

  if (service) {
    const url = new URL(service.url)

    try {
      const ws = new WebSocket(`ws://${url.host}`)

      ws.onmessage = (o) => {
        const data = JSON.parse(o.data)
        onData({source: label, ...data})
      }

      let send = (o: any) => {
        ws.send(JSON.stringify(o))
      }

      ws.onopen = () => {
        send({ command: 'platform' })
        send({ command: 'version' })
      }
    } catch (e) {
      console.error('Failed to connect to Node.js server', e)
    }
  }
})

function runVersionRequest(id: string, label: string = id[0].toUpperCase() + id.slice(1)) {
  if (commoners.services[id]) {

    const url = new URL(commoners.services[id].url) // Equivalent to commoners://python
  
    const runCommands = async () => {
        fetch(new URL('version', url))
        .then(res => res.json())
        .then(payload => onData({ source: label, command: 'version', payload }))
        .catch(e => console.error(`Failed to request from ${label} server`, e))
    }
  
    const service = commoners.services[id]
    if (commoners.target === 'desktop'){
      service.onActivityDetected(runCommands)
      service.onClosed(() => console.error(`${label} server was closed!`))
    } 
    
    else runCommands()
   
  }
}

// --------- Python Service Test (OpenAPI) ---------
runVersionRequest('python')


// --------- C++ Service Test ---------
runVersionRequest('cpp', 'C++')


// --------- Web Serial Test ---------
async function requestSerialPort () {

  try {

    const port = await navigator.serial.requestPort({ 
      // filters
    })
    const portInfo = port.getInfo()
    display(`Connected to Serial Port: vendorId: ${portInfo.usbVendorId} | productId: ${portInfo.usbProductId}`)
  } catch (e: any) {
    console.error(e)
  }
}


commoners.ready.then(plugins => {

  if ('localServices' in plugins) {

    const localServices = plugins['localServices']
    const ids: { [x:string]: string }  = {}

    localServices.onFound((url) => {
      if (ids[url]) return
      const id = ids[url] = Math.random().toString(36).substring(7)
      createClient(url, id)
    })

    localServices.onClosed((url) => {
      const el = document.getElementById(ids[url])
      if (el) el.remove()
      delete ids[url]
    })

    localServices.get()

  }


  const testSerialConnection = document.getElementById('testSerialConnection')
  if (testSerialConnection) {
    if ('serial' in plugins) testSerialConnection.addEventListener('click', requestSerialPort)
    else testSerialConnection.setAttribute('disabled', '')
  }
  // --------- Web Bluetooth Test ---------
  async function requestBluetoothDevice () {

    // Use the Capacitor API to support mobile
    await BleClient.initialize();
    const device = await BleClient.requestDevice();

    // const device = await navigator.bluetooth.requestDevice({ acceptAllDevices: true })
    console.log(device)
    display(`Connected to Bluetooth Device: ${device.name || `ID: ${device.id}`}`)
  }

  const testBluetoothConnection = document.getElementById('testBluetoothConnection')

  if (testBluetoothConnection) {
    if ('bluetooth' in plugins) testBluetoothConnection.addEventListener('click', requestBluetoothDevice)
    else testBluetoothConnection.setAttribute('disabled', '')
  }

})
