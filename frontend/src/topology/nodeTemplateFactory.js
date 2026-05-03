import go from 'gojs'

const $ = go.GraphObject.make

// ---- Port configuration per device type (used by LinkConfigDialog) ----
const PORT_SPECS = {
  router:       { count: 6, names: ['GE0/0/0', 'GE0/0/1', 'GE0/0/2', 'GE0/0/3', 'GE0/0/4', 'GE0/0/5'], ethTrunkNames: [] },
  switch:       { count: 10, names: ['GE0/0/1', 'GE0/0/2', 'GE0/0/3', 'GE0/0/4', 'GE0/0/5', 'GE0/0/6', 'GE0/0/7', 'GE0/0/8', 'GE0/0/9', 'GE0/0/10'], ethTrunkNames: ['Eth-Trunk1', 'Eth-Trunk2', 'Eth-Trunk3', 'Eth-Trunk4', 'Eth-Trunk5', 'Eth-Trunk6', 'Eth-Trunk7', 'Eth-Trunk8'] },
  firewall:     { count: 6, names: ['GE0/0/0', 'GE0/0/1', 'GE0/0/2', 'GE0/0/3', 'GE0/0/4', 'GE0/0/5'], ethTrunkNames: [] },
  ips:          { count: 6, names: ['GE0/0/0', 'GE0/0/1', 'GE0/0/2', 'GE0/0/3', 'GE0/0/4', 'GE0/0/5'], ethTrunkNames: [] },
  pc:           { count: 1, names: ['ETH0'], ethTrunkNames: [] },
  laptop:       { count: 1, names: ['ETH0'], ethTrunkNames: [] },
  server:       { count: 2, names: ['ETH0', 'ETH1'], ethTrunkNames: [] },
  phone:        { count: 1, names: ['ETH0'], ethTrunkNames: [] },
  camera:       { count: 1, names: ['ETH0'], ethTrunkNames: [] },
  nvr:          { count: 2, names: ['ETH0', 'ETH1'], ethTrunkNames: [] },
  printer:      { count: 1, names: ['ETH0'], ethTrunkNames: [] },
  'dumb-switch':{ count: 8, names: ['GE0/0/1', 'GE0/0/2', 'GE0/0/3', 'GE0/0/4', 'GE0/0/5', 'GE0/0/6', 'GE0/0/7', 'GE0/0/8'], ethTrunkNames: [] },
  ap:           { count: 1, names: ['ETH0'], ethTrunkNames: [] },
  ac:           { count: 4, names: ['GE0/0/0', 'GE0/0/1', 'GE0/0/2', 'GE0/0/3'], ethTrunkNames: [] },
  cloud:        { count: 3, names: ['ETH0', 'ETH1', 'ETH2'], ethTrunkNames: [] },
}

// ---- Reusable helpers ----

function slotRect(w, h) {
  return $(go.Shape, 'Rectangle', {
    width: w || 14, height: h || 6,
    fill: '#37474F', stroke: '#263238',
    strokeWidth: 1,
    margin: new go.Margin(0, 2, 0, 0),
  })
}

function led(color) {
  return $(go.Shape, 'Circle', {
    width: 4, height: 4,
    fill: color, stroke: '#555',
    margin: new go.Margin(0, 2),
  })
}

function portInd() {
  return $(go.Shape, 'Rectangle', {
    width: 7, height: 4,
    fill: '#B0BEC5', stroke: '#78909C',
    strokeWidth: 0.5,
    margin: new go.Margin(0, 1.5),
  })
}

function linkableBody(shape, portId) {
  shape.portId = portId || ''
  shape.fromLinkable = true
  shape.toLinkable = true
  shape.cursor = 'crosshair'
}

function labelBlock() {
  return $(go.TextBlock, {
    alignment: go.Spot.BottomCenter,
    alignmentFocus: go.Spot.TopCenter,
    margin: new go.Margin(4, 0, 0, 0),
    font: 'bold 11px "Microsoft YaHei", sans-serif',
    stroke: '#333',
    editable: true,
    textAlign: 'center',
  }, new go.Binding('text', 'label').makeTwoWay())
}

// ---- Device Templates ----

function makeRouterTemplate() {
  const body = $(go.Shape, 'RoundedRectangle', {
    fill: '#4FC3F7', stroke: '#0277BD', strokeWidth: 2,
    minSize: new go.Size(110, 52),
    parameter1: 5,
  })
  linkableBody(body, 'body')
  return $(go.Node, 'Spot',
    { locationObjectName: 'BODY', selectionObjectName: 'BODY' },
    new go.Binding('location', 'loc', go.Point.parse).makeTwoWay(go.Point.stringify),
    $(go.Panel, 'Auto',
      { name: 'BODY' },
      body,
      $(go.Panel, 'Vertical',
        { margin: new go.Margin(5, 8, 5, 8) },
        $(go.Panel, 'Horizontal',
          { margin: new go.Margin(1, 0) },
          slotRect(14, 6), slotRect(14, 6), slotRect(14, 6), slotRect(14, 6)
        ),
        $(go.Panel, 'Horizontal',
          { margin: new go.Margin(1, 0) },
          slotRect(14, 6), slotRect(14, 6), slotRect(14, 6), slotRect(14, 6)
        ),
        $(go.Panel, 'Horizontal',
          { margin: new go.Margin(3, 0, 0, 0) },
          led('#4CAF50'), led('#4CAF50'), led('#FFC107'), led('#4CAF50')
        ),
      ),
    ),
    labelBlock(),
  )
}

function makeSwitchTemplate() {
  const body = $(go.Shape, 'RoundedRectangle', {
    fill: '#546E7A', stroke: '#263238', strokeWidth: 2,
    minSize: new go.Size(160, 56),
    parameter1: 4,
  })
  linkableBody(body, 'body')
  return $(go.Node, 'Spot',
    { locationObjectName: 'BODY', selectionObjectName: 'BODY' },
    new go.Binding('location', 'loc', go.Point.parse).makeTwoWay(go.Point.stringify),
    $(go.Panel, 'Auto',
      { name: 'BODY' },
      body,
      $(go.Panel, 'Vertical',
        { margin: new go.Margin(5, 8, 3, 8) },
        $(go.Panel, 'Horizontal',
          { margin: new go.Margin(1, 0) },
          portInd(), portInd(), portInd(), portInd(),
          portInd(), portInd(), portInd(), portInd()
        ),
        $(go.Panel, 'Horizontal',
          { margin: new go.Margin(1, 0) },
          portInd(), portInd(), portInd(), portInd(),
          portInd(), portInd(), portInd(), portInd()
        ),
        $(go.Panel, 'Horizontal',
          { margin: new go.Margin(3, 0, 0, 0) },
          led('#4CAF50'), led('#4CAF50'), led('#FFC107'), led('#4CAF50')
        ),
      ),
    ),
    labelBlock(),
  )
}

function makePcTemplate() {
  const body = $(go.Shape, 'RoundedRectangle', {
    fill: '#263238', stroke: '#000', strokeWidth: 2,
    width: 56, height: 42,
    parameter1: 3,
  })
  linkableBody(body, 'body')
  return $(go.Node, 'Spot',
    { locationObjectName: 'BODY', selectionObjectName: 'BODY' },
    new go.Binding('location', 'loc', go.Point.parse).makeTwoWay(go.Point.stringify),
    $(go.Panel, 'Auto',
      { name: 'BODY' },
      body,
      $(go.Shape, 'RoundedRectangle', {
        fill: '#1565C0', stroke: '#0D47A1',
        width: 48, height: 34,
        parameter1: 2,
        alignment: go.Spot.Center,
      }),
      $(go.Shape, 'Rectangle', {
        fill: '#37474F', stroke: '#263238',
        width: 8, height: 9,
        alignment: go.Spot.BottomCenter,
        alignmentFocus: go.Spot.TopCenter,
      }),
      $(go.Shape, 'Rectangle', {
        fill: '#37474F', stroke: '#263238',
        width: 28, height: 5,
        alignment: go.Spot.BottomCenter,
        alignmentFocus: go.Spot.TopCenter,
      }),
    ),
    labelBlock(),
  )
}

function makeLaptopTemplate() {
  const body = $(go.Shape, 'RoundedRectangle', {
    fill: '#37474F', stroke: '#000', strokeWidth: 2,
    width: 50, height: 34,
    parameter1: 3,
  })
  linkableBody(body, 'body')
  return $(go.Node, 'Spot',
    { locationObjectName: 'BODY', selectionObjectName: 'BODY' },
    new go.Binding('location', 'loc', go.Point.parse).makeTwoWay(go.Point.stringify),
    $(go.Panel, 'Auto',
      { name: 'BODY' },
      body,
      $(go.Shape, 'RoundedRectangle', {
        fill: '#1565C0', stroke: '#0D47A1',
        width: 42, height: 26,
        parameter1: 2,
        alignment: go.Spot.Center,
      }),
      $(go.Shape, 'RoundedRectangle', {
        fill: '#37474F', stroke: '#263238',
        width: 60, height: 5,
        alignment: go.Spot.BottomCenter,
        alignmentFocus: go.Spot.TopCenter,
      }),
    ),
    labelBlock(),
  )
}

function makeServerTemplate() {
  const body = $(go.Shape, 'RoundedRectangle', {
    fill: '#424242', stroke: '#212121', strokeWidth: 2,
    minSize: new go.Size(48, 68),
    parameter1: 3,
  })
  linkableBody(body, 'body')
  return $(go.Node, 'Spot',
    { locationObjectName: 'BODY', selectionObjectName: 'BODY' },
    new go.Binding('location', 'loc', go.Point.parse).makeTwoWay(go.Point.stringify),
    $(go.Panel, 'Auto',
      { name: 'BODY' },
      body,
      $(go.Panel, 'Vertical',
        { margin: new go.Margin(6, 5, 5, 5) },
        $(go.Panel, 'Horizontal', { margin: new go.Margin(1, 0) },
          $(go.Shape, 'Rectangle', { width: 8, height: 3, fill: '#BDBDBD', stroke: null }),
          $(go.Shape, 'Rectangle', { width: 22, height: 7, fill: '#616161', stroke: '#424242', margin: new go.Margin(0, 2) }),
          $(go.Shape, 'Circle', { width: 3, height: 3, fill: '#4CAF50' }),
        ),
        $(go.Panel, 'Horizontal', { margin: new go.Margin(1, 0) },
          $(go.Shape, 'Rectangle', { width: 8, height: 3, fill: '#BDBDBD', stroke: null }),
          $(go.Shape, 'Rectangle', { width: 22, height: 7, fill: '#616161', stroke: '#424242', margin: new go.Margin(0, 2) }),
          $(go.Shape, 'Circle', { width: 3, height: 3, fill: '#4CAF50' }),
        ),
        $(go.Panel, 'Horizontal', { margin: new go.Margin(1, 0) },
          $(go.Shape, 'Rectangle', { width: 8, height: 3, fill: '#BDBDBD', stroke: null }),
          $(go.Shape, 'Rectangle', { width: 22, height: 7, fill: '#616161', stroke: '#424242', margin: new go.Margin(0, 2) }),
          $(go.Shape, 'Circle', { width: 3, height: 3, fill: '#FFC107' }),
        ),
        $(go.Panel, 'Horizontal', { margin: new go.Margin(3, 0, 0, 0) },
          $(go.Shape, 'Rectangle', { width: 14, height: 2, fill: '#616161', stroke: null, margin: 0.5 }),
          $(go.Shape, 'Rectangle', { width: 14, height: 2, fill: '#616161', stroke: null, margin: 0.5 }),
        ),
      ),
    ),
    labelBlock(),
  )
}

function makeFirewallTemplate() {
  const body = $(go.Shape, 'RoundedRectangle', {
    fill: '#FF7043', stroke: '#BF360C', strokeWidth: 2,
    minSize: new go.Size(100, 52),
    parameter1: 4,
  })
  linkableBody(body, 'body')
  return $(go.Node, 'Spot',
    { locationObjectName: 'BODY', selectionObjectName: 'BODY' },
    new go.Binding('location', 'loc', go.Point.parse).makeTwoWay(go.Point.stringify),
    $(go.Panel, 'Auto',
      { name: 'BODY' },
      body,
      $(go.Panel, 'Vertical',
        { margin: new go.Margin(4, 8) },
        $(go.Panel, 'Horizontal', { margin: new go.Margin(1, 0) },
          $(go.Shape, 'Rectangle', { width: 65, height: 3, fill: '#BF360C', stroke: null }),
        ),
        $(go.Panel, 'Horizontal', { margin: new go.Margin(4, 0, 0, 0) },
          led('#4CAF50'), led('#FFC107'), led('#4CAF50')
        ),
      ),
    ),
    labelBlock(),
  )
}

function makeApTemplate() {
  const body = $(go.Shape, 'RoundedRectangle', {
    fill: '#ECEFF1', stroke: '#546E7A', strokeWidth: 2,
    width: 46, height: 32,
    parameter1: 8,
  })
  linkableBody(body, 'body')
  return $(go.Node, 'Spot',
    { locationObjectName: 'BODY', selectionObjectName: 'BODY' },
    new go.Binding('location', 'loc', go.Point.parse).makeTwoWay(go.Point.stringify),
    $(go.Panel, 'Auto',
      { name: 'BODY' },
      body,
      $(go.Panel, 'Vertical',
        { alignment: go.Spot.Center },
        $(go.Shape, { geometryString: 'M 2 12 A 10 10 0 0 1 22 12', stroke: '#1565C0', strokeWidth: 2, fill: null, width: 24, height: 14 }),
        $(go.Shape, { geometryString: 'M 6 8 A 6 6 0 0 1 18 8', stroke: '#1565C0', strokeWidth: 2, fill: null, width: 24, height: 8 }),
        $(go.Shape, { geometryString: 'M 10 4 A 2 2 0 0 1 14 4', stroke: '#1565C0', strokeWidth: 2, fill: null, width: 24, height: 5 }),
      ),
    ),
    labelBlock(),
  )
}

function makeAcTemplate() {
  const body = $(go.Shape, 'RoundedRectangle', {
    fill: '#7E57C2', stroke: '#4A148C', strokeWidth: 2,
    minSize: new go.Size(90, 50),
    parameter1: 4,
  })
  linkableBody(body, 'body')
  return $(go.Node, 'Spot',
    { locationObjectName: 'BODY', selectionObjectName: 'BODY' },
    new go.Binding('location', 'loc', go.Point.parse).makeTwoWay(go.Point.stringify),
    $(go.Panel, 'Auto',
      { name: 'BODY' },
      body,
      $(go.Panel, 'Vertical',
        { margin: new go.Margin(4, 8) },
        $(go.Panel, 'Horizontal', { margin: new go.Margin(1, 0) },
          led('#4CAF50'), led('#4CAF50'), led('#4CAF50'), led('#FFC107')
        ),
        $(go.Panel, 'Horizontal', { margin: new go.Margin(3, 0, 0, 0) },
          $(go.Shape, 'Rectangle', { width: 55, height: 3, fill: '#4A148C', stroke: null }),
        ),
      ),
    ),
    labelBlock(),
  )
}

function makePhoneTemplate() {
  const body = $(go.Shape, 'RoundedRectangle', {
    fill: '#37474F', stroke: '#000', strokeWidth: 2,
    width: 30, height: 44,
    parameter1: 4,
  })
  linkableBody(body, 'body')
  return $(go.Node, 'Spot',
    { locationObjectName: 'BODY', selectionObjectName: 'BODY' },
    new go.Binding('location', 'loc', go.Point.parse).makeTwoWay(go.Point.stringify),
    $(go.Panel, 'Auto',
      { name: 'BODY' },
      body,
      $(go.Shape, 'RoundedRectangle', {
        fill: '#E0E0E0', stroke: '#BDBDBD',
        width: 22, height: 32,
        parameter1: 2,
        alignment: go.Spot.Center,
        alignmentFocus: new go.Spot(0.5, 0.45),
      }),
      $(go.Shape, 'Circle', {
        width: 3, height: 3,
        fill: '#78909C',
        alignment: go.Spot.BottomCenter,
        alignmentFocus: go.Spot.TopCenter,
      }),
    ),
    labelBlock(),
  )
}

function makeCameraTemplate() {
  const body = $(go.Shape, 'RoundedRectangle', {
    fill: '#ECEFF1', stroke: '#37474F', strokeWidth: 2,
    width: 48, height: 38,
    parameter1: 3,
  })
  linkableBody(body, 'body')
  return $(go.Node, 'Spot',
    { locationObjectName: 'BODY', selectionObjectName: 'BODY' },
    new go.Binding('location', 'loc', go.Point.parse).makeTwoWay(go.Point.stringify),
    $(go.Panel, 'Auto',
      { name: 'BODY' },
      body,
      $(go.Panel, 'Spot',
        $(go.Shape, { geometryString: 'M 4 16 Q 24 2 44 16', stroke: '#546E7A', strokeWidth: 2, fill: '#B0BEC5', width: 48, height: 20 }),
        $(go.Shape, 'Circle', { width: 10, height: 10, fill: '#263238', alignment: new go.Spot(0.5, 0.65) }),
        $(go.Shape, 'Circle', { width: 6, height: 6, fill: '#1565C0', alignment: new go.Spot(0.5, 0.65) }),
        $(go.Shape, 'Circle', { width: 3, height: 3, fill: '#42A5F5', alignment: new go.Spot(0.5, 0.65) }),
      ),
    ),
    labelBlock(),
  )
}

function makeNvrTemplate() {
  const body = $(go.Shape, 'RoundedRectangle', {
    fill: '#37474F', stroke: '#212121', strokeWidth: 2,
    minSize: new go.Size(60, 50),
    parameter1: 3,
  })
  linkableBody(body, 'body')
  return $(go.Node, 'Spot',
    { locationObjectName: 'BODY', selectionObjectName: 'BODY' },
    new go.Binding('location', 'loc', go.Point.parse).makeTwoWay(go.Point.stringify),
    $(go.Panel, 'Auto',
      { name: 'BODY' },
      body,
      $(go.Panel, 'Vertical',
        { margin: new go.Margin(5, 8) },
        $(go.Panel, 'Horizontal', { margin: new go.Margin(1, 0) },
          $(go.Shape, 'Rectangle', { width: 35, height: 5, fill: '#616161', stroke: null }),
          $(go.Shape, 'Circle', { width: 3, height: 3, fill: '#F44336', margin: new go.Margin(0, 0, 0, 3) }),
        ),
        $(go.Panel, 'Horizontal', { margin: new go.Margin(2, 0) },
          $(go.Shape, 'Rectangle', { width: 35, height: 5, fill: '#616161', stroke: null }),
          $(go.Shape, 'Circle', { width: 3, height: 3, fill: '#4CAF50', margin: new go.Margin(0, 0, 0, 3) }),
        ),
        $(go.Panel, 'Horizontal', { margin: new go.Margin(2, 0) },
          $(go.Shape, 'Rectangle', { width: 35, height: 5, fill: '#616161', stroke: null }),
          $(go.Shape, 'Circle', { width: 3, height: 3, fill: '#4CAF50', margin: new go.Margin(0, 0, 0, 3) }),
        ),
      ),
    ),
    labelBlock(),
  )
}

function makeDumbSwitchTemplate() {
  const body = $(go.Shape, 'RoundedRectangle', {
    fill: '#78909C', stroke: '#455A64', strokeWidth: 2,
    minSize: new go.Size(110, 46),
    parameter1: 3,
  })
  linkableBody(body, 'body')
  return $(go.Node, 'Spot',
    { locationObjectName: 'BODY', selectionObjectName: 'BODY' },
    new go.Binding('location', 'loc', go.Point.parse).makeTwoWay(go.Point.stringify),
    $(go.Panel, 'Auto',
      { name: 'BODY' },
      body,
      $(go.Panel, 'Vertical',
        { margin: new go.Margin(4, 6) },
        $(go.Panel, 'Horizontal',
          portInd(), portInd(), portInd(), portInd(), portInd(), portInd(), portInd(), portInd(),
        ),
        $(go.Panel, 'Horizontal', { margin: new go.Margin(2, 0, 0, 0) },
          portInd(), portInd(), portInd(), portInd(), portInd(), portInd(), portInd(), portInd(),
        ),
        $(go.Panel, 'Horizontal', { margin: new go.Margin(3, 0, 0, 0) },
          $(go.Shape, 'Rectangle', { width: 90, height: 4, fill: '#455A64', stroke: null }),
        ),
      ),
    ),
    labelBlock(),
  )
}

function makePrinterTemplate() {
  const body = $(go.Shape, 'RoundedRectangle', {
    fill: '#ECEFF1', stroke: '#546E7A', strokeWidth: 2,
    minSize: new go.Size(64, 46),
    parameter1: 4,
  })
  linkableBody(body, 'body')
  return $(go.Node, 'Spot',
    { locationObjectName: 'BODY', selectionObjectName: 'BODY' },
    new go.Binding('location', 'loc', go.Point.parse).makeTwoWay(go.Point.stringify),
    $(go.Panel, 'Auto',
      { name: 'BODY' },
      body,
      $(go.Panel, 'Vertical',
        { margin: new go.Margin(4, 6) },
        $(go.Shape, 'RoundedRectangle', { width: 46, height: 14, fill: '#B0BEC5', stroke: '#78909C', parameter1: 2 }),
        $(go.Shape, 'Rectangle', { width: 50, height: 4, fill: '#FAFAFA', stroke: '#BDBDBD', margin: new go.Margin(2, 0, 0, 0) }),
        $(go.Shape, 'RoundedRectangle', { width: 54, height: 5, fill: '#78909C', stroke: null, margin: new go.Margin(3, 0, 0, 0) }),
        $(go.Shape, 'Rectangle', { width: 30, height: 3, fill: '#546E7A', stroke: null, margin: new go.Margin(1, 0, 0, 18) }),
      ),
    ),
    labelBlock(),
  )
}

function makeIpsTemplate() {
  const body = $(go.Shape, 'RoundedRectangle', {
    fill: '#AB47BC', stroke: '#6A1B9A', strokeWidth: 2,
    minSize: new go.Size(110, 52),
    parameter1: 4,
  })
  linkableBody(body, 'body')
  return $(go.Node, 'Spot',
    { locationObjectName: 'BODY', selectionObjectName: 'BODY' },
    new go.Binding('location', 'loc', go.Point.parse).makeTwoWay(go.Point.stringify),
    $(go.Panel, 'Auto',
      { name: 'BODY' },
      body,
      $(go.Panel, 'Vertical',
        { margin: new go.Margin(4, 8) },
        $(go.Panel, 'Horizontal', { margin: new go.Margin(1, 0) },
          $(go.Shape, 'Rectangle', { width: 70, height: 3, fill: '#6A1B9A', stroke: null }),
        ),
        $(go.Panel, 'Horizontal', { margin: new go.Margin(2, 0) },
          $(go.Shape, 'Rectangle', { width: 70, height: 3, fill: '#6A1B9A', stroke: null }),
        ),
        $(go.Panel, 'Horizontal', { margin: new go.Margin(4, 0, 0, 0) },
          led('#4CAF50'), led('#FFC107'), led('#4CAF50')
        ),
      ),
    ),
    labelBlock(),
  )
}

function makeCloudTemplate() {
  const body = $(go.Shape, 'RoundedRectangle', {
    fill: '#BBDEFB', stroke: '#1565C0', strokeWidth: 2,
    minSize: new go.Size(80, 48),
    parameter1: 20,
  })
  linkableBody(body, 'body')
  return $(go.Node, 'Spot',
    { locationObjectName: 'BODY', selectionObjectName: 'BODY' },
    new go.Binding('location', 'loc', go.Point.parse).makeTwoWay(go.Point.stringify),
    $(go.Panel, 'Auto',
      { name: 'BODY' },
      body,
      $(go.Shape, 'RoundedRectangle', {
        fill: '#E3F2FD', stroke: null,
        width: 40, height: 20,
        parameter1: 10,
        alignment: new go.Spot(0.5, 0.2),
      }),
    ),
    labelBlock(),
  )
}

// ---- Export template map and port specs ----

export function createNodeTemplateMap() {
  const map = new go.Map()
  map.add('router', makeRouterTemplate())
  map.add('switch', makeSwitchTemplate())
  map.add('pc', makePcTemplate())
  map.add('laptop', makeLaptopTemplate())
  map.add('server', makeServerTemplate())
  map.add('firewall', makeFirewallTemplate())
  map.add('ips', makeIpsTemplate())
  map.add('camera', makeCameraTemplate())
  map.add('nvr', makeNvrTemplate())
  map.add('dumb-switch', makeDumbSwitchTemplate())
  map.add('printer', makePrinterTemplate())
  map.add('ap', makeApTemplate())
  map.add('ac', makeAcTemplate())
  map.add('phone', makePhoneTemplate())
  map.add('cloud', makeCloudTemplate())
  return map
}

export { PORT_SPECS }
