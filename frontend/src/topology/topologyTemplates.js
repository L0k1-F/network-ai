/**
 * Pre-built network topology templates.
 * Each template returns { name, description, data: { nodes, links } }
 * suitable for TopologyEditor.importTopologyFromAnalysis().
 */

let _counter = 0
function key(prefix) {
  _counter++
  return `${prefix}_${_counter}`
}

function resetCounter() { _counter = 0 }

function switchNode(opts = {}) {
  return {
    category: 'switch',
    role: 'access',
    vendor: 'Huawei',
    zone: '内部网络',
    ...opts,
  }
}

function routerNode(opts = {}) {
  return {
    category: 'router',
    role: 'router',
    vendor: 'Huawei',
    zone: '外部网络',
    ...opts,
  }
}

function firewallNode(opts = {}) {
  return {
    category: 'firewall',
    role: 'security',
    vendor: 'Huawei',
    zone: '外部网络',
    ...opts,
  }
}

function endpointNode(opts = {}) {
  return {
    category: 'terminal',
    role: 'endpoint',
    vendor: 'Huawei',
    zone: '终端区',
    ...opts,
  }
}

function trunkLink(from, to, vlans = [10, 20], opts = {}) {
  return { from, to, mode: 'trunk', allowedVlans: vlans, ...opts }
}

function accessLink(from, to, vlan = 10, opts = {}) {
  return { from, to, mode: 'access', accessVlan: vlan, ...opts }
}

// ---- Template definitions ----

const templates = [
  {
    name: '中小型三层架构',
    description: '经典核心-汇聚-接入三层网络，适合中型企业（50-200 终端）',
    icon: '🏢',
    generate() {
      resetCounter()
      const core1 = key('Core-SW')
      const core2 = key('Core-SW')
      const agg1 = key('Agg-SW')
      const agg2 = key('Agg-SW')
      const acc1 = key('Acc-SW')
      const acc2 = key('Acc-SW')
      const rtr = key('Router')
      const fw = key('FW')
      const srv = key('Server')
      const pc1 = key('PC')
      const pc2 = key('PC')

      const nodes = {
        [core1]: switchNode({ label: 'Core-SW-1', role: 'core', zone: '内部网络' }),
        [core2]: switchNode({ label: 'Core-SW-2', role: 'core', zone: '内部网络' }),
        [agg1]: switchNode({ label: 'Agg-SW-1', role: 'aggregation', zone: '内部网络' }),
        [agg2]: switchNode({ label: 'Agg-SW-2', role: 'aggregation', zone: '内部网络' }),
        [acc1]: switchNode({ label: 'Acc-SW-1', role: 'access', zone: '内部网络' }),
        [acc2]: switchNode({ label: 'Acc-SW-2', role: 'access', zone: '内部网络' }),
        [rtr]: routerNode({ label: 'Router-Internet' }),
        [fw]: firewallNode({ label: 'FW-Internet', zone: 'DMZ区' }),
        [srv]: endpointNode({ label: 'Web-Server', zone: 'DMZ区' }),
        [pc1]: endpointNode({ label: 'PC-1' }),
        [pc2]: endpointNode({ label: 'PC-2' }),
      }

      const links = [
        trunkLink(core1, core2, [10, 20, 30, 99]),
        trunkLink(core1, agg1, [10, 20, 30]),
        trunkLink(core2, agg2, [10, 20, 30]),
        trunkLink(agg1, acc1, [10, 20]),
        trunkLink(agg2, acc2, [10, 20]),
        trunkLink(core1, rtr, [10, 20, 30]),
        trunkLink(rtr, fw, [10, 20, 30]),
        accessLink(acc1, pc1, 10),
        accessLink(acc2, pc2, 20),
        accessLink(fw, srv, 30),
      ]

      // Layout hints
      nodes[core1].x = 400; nodes[core1].y = 180
      nodes[core2].x = 550; nodes[core2].y = 180
      nodes[agg1].x = 350; nodes[agg1].y = 300
      nodes[agg2].x = 600; nodes[agg2].y = 300
      nodes[acc1].x = 300; nodes[acc1].y = 420
      nodes[acc2].x = 650; nodes[acc2].y = 420
      nodes[rtr].x = 400; nodes[rtr].y = 60
      nodes[fw].x = 550; nodes[fw].y = 60
      nodes[srv].x = 700; nodes[srv].y = 60
      nodes[pc1].x = 250; nodes[pc1].y = 520
      nodes[pc2].x = 700; nodes[pc2].y = 520

      return { nodes, links }
    },
  },

  {
    name: '园区网',
    description: '多栋楼宇汇聚到大楼核心，适用校园/园区（200-1000 终端）',
    icon: '🏫',
    generate() {
      resetCounter()
      const core = key('Core-SW')
      const fw = key('FW-Internet')
      const rtr = key('Router')
      const bld1_agg = key('Bld1-Agg')
      const bld2_agg = key('Bld2-Agg')
      const bld3_agg = key('Bld3-Agg')
      const bld1_acc = key('Bld1-Acc')
      const bld2_acc = key('Bld2-Acc')
      const bld3_acc = key('Bld3-Acc')
      const pc1 = key('PC')
      const pc2 = key('PC')
      const pc3 = key('PC')
      const srv = key('Server')

      const nodes = {
        [core]: switchNode({ label: 'Core-SW', role: 'core', zone: '内部网络' }),
        [fw]: firewallNode({ label: 'FW-Internet', zone: '外部网络' }),
        [rtr]: routerNode({ label: 'Router-ISP' }),
        [bld1_agg]: switchNode({ label: 'Bld1-Agg-SW', role: 'aggregation', zone: '内部网络' }),
        [bld2_agg]: switchNode({ label: 'Bld2-Agg-SW', role: 'aggregation', zone: '内部网络' }),
        [bld3_agg]: switchNode({ label: 'Bld3-Agg-SW', role: 'aggregation', zone: '内部网络' }),
        [bld1_acc]: switchNode({ label: 'Bld1-Acc-SW', role: 'access', zone: '内部网络' }),
        [bld2_acc]: switchNode({ label: 'Bld2-Acc-SW', role: 'access', zone: '内部网络' }),
        [bld3_acc]: switchNode({ label: 'Bld3-Acc-SW', role: 'access', zone: '内部网络' }),
        [pc1]: endpointNode({ label: 'PC-Bld1' }),
        [pc2]: endpointNode({ label: 'PC-Bld2' }),
        [pc3]: endpointNode({ label: 'PC-Bld3' }),
        [srv]: endpointNode({ label: 'Data-Server', zone: 'DMZ区' }),
      }

      const links = [
        trunkLink(rtr, fw, [10, 20, 30, 99]),
        trunkLink(fw, core, [10, 20, 30, 99]),
        trunkLink(core, bld1_agg, [10]),
        trunkLink(core, bld2_agg, [20]),
        trunkLink(core, bld3_agg, [30]),
        trunkLink(bld1_agg, bld1_acc, [10]),
        trunkLink(bld2_agg, bld2_acc, [20]),
        trunkLink(bld3_agg, bld3_acc, [30]),
        accessLink(bld1_acc, pc1, 10),
        accessLink(bld2_acc, pc2, 20),
        accessLink(bld3_acc, pc3, 30),
        accessLink(core, srv, 99),
      ]

      nodes[rtr].x = 475; nodes[rtr].y = 20
      nodes[fw].x = 475; nodes[fw].y = 90
      nodes[core].x = 475; nodes[core].y = 180
      nodes[bld1_agg].x = 230; nodes[bld1_agg].y = 280
      nodes[bld2_agg].x = 475; nodes[bld2_agg].y = 280
      nodes[bld3_agg].x = 720; nodes[bld3_agg].y = 280
      nodes[bld1_acc].x = 230; nodes[bld1_acc].y = 380
      nodes[bld2_acc].x = 475; nodes[bld2_acc].y = 380
      nodes[bld3_acc].x = 720; nodes[bld3_acc].y = 380
      nodes[pc1].x = 150; nodes[pc1].y = 480
      nodes[pc2].x = 420; nodes[pc2].y = 480
      nodes[pc3].x = 690; nodes[pc3].y = 480
      nodes[srv].x = 700; nodes[srv].y = 180

      return { nodes, links }
    },
  },

  {
    name: '等保合规拓扑',
    description: '符合等保2.0三级要求的网络安全架构，含DMZ区、审计区、管理区',
    icon: '🛡️',
    generate() {
      resetCounter()
      const fw_ext = key('FW-External')
      const fw_int = key('FW-Internal')
      const core = key('Core-SW')
      const dmz_sw = key('DMZ-SW')
      const mgmt_sw = key('Mgmt-SW')
      const acc = key('Acc-SW')
      const web = key('Web-Server')
      const db = key('DB-Server')
      const audit = key('Audit-Server')
      const mgmt = key('Mgmt-PC')
      const pc = key('PC')

      const nodes = {
        [fw_ext]: firewallNode({ label: 'FW-External', zone: '外部网络' }),
        [fw_int]: firewallNode({ label: 'FW-Internal', zone: 'DMZ区' }),
        [core]: switchNode({ label: 'Core-SW', role: 'core', zone: '内部网络' }),
        [dmz_sw]: switchNode({ label: 'DMZ-SW', role: 'aggregation', zone: 'DMZ区' }),
        [mgmt_sw]: switchNode({ label: 'Mgmt-SW', role: 'access', zone: '管理区' }),
        [acc]: switchNode({ label: 'Acc-SW', role: 'access', zone: '内部网络' }),
        [web]: endpointNode({ label: 'Web-Server', zone: 'DMZ区' }),
        [db]: endpointNode({ label: 'DB-Server', zone: '内部网络' }),
        [audit]: endpointNode({ label: 'Audit-Server', zone: '管理区' }),
        [mgmt]: endpointNode({ label: 'Mgmt-Terminal', zone: '管理区' }),
        [pc]: endpointNode({ label: 'Office-PC', zone: '内部网络' }),
      }

      const links = [
        trunkLink(fw_ext, fw_int, [10, 20, 30, 99]),
        trunkLink(fw_int, core, [20, 30, 99]),
        trunkLink(fw_int, dmz_sw, [10]),
        trunkLink(core, acc, [20, 30]),
        trunkLink(core, mgmt_sw, [99]),
        accessLink(dmz_sw, web, 10),
        accessLink(acc, db, 20),
        accessLink(acc, pc, 30),
        accessLink(mgmt_sw, audit, 99),
        accessLink(mgmt_sw, mgmt, 99),
      ]

      nodes[fw_ext].x = 420; nodes[fw_ext].y = 20
      nodes[fw_int].x = 420; nodes[fw_int].y = 100
      nodes[core].x = 420; nodes[core].y = 190
      nodes[dmz_sw].x = 150; nodes[dmz_sw].y = 100
      nodes[mgmt_sw].x = 700; nodes[mgmt_sw].y = 190
      nodes[acc].x = 420; nodes[acc].y = 300
      nodes[web].x = 50; nodes[web].y = 100
      nodes[db].x = 320; nodes[db].y = 380
      nodes[pc].x = 520; nodes[pc].y = 380
      nodes[audit].x = 700; nodes[audit].y = 300
      nodes[mgmt].x = 850; nodes[mgmt].y = 300

      return { nodes, links }
    },
  },

  {
    name: '简单办公网',
    description: '单台核心交换机+防火墙，适合小型办公室（10-50 终端）',
    icon: '🏠',
    generate() {
      resetCounter()
      const fw = key('FW')
      const core = key('Core-SW')
      const ap = key('AP')
      const pc1 = key('PC')
      const pc2 = key('PC')
      const printer = key('Printer')

      const nodes = {
        [fw]: firewallNode({ label: 'FW-Office', zone: '外部网络' }),
        [core]: switchNode({ label: 'Core-SW', role: 'core', zone: '内部网络' }),
        [ap]: endpointNode({ label: 'Office-AP', category: 'wireless', role: 'wireless', zone: '无线区' }),
        [pc1]: endpointNode({ label: 'PC-1' }),
        [pc2]: endpointNode({ label: 'PC-2' }),
        [printer]: endpointNode({ label: 'Printer' }),
      }

      const links = [
        trunkLink(fw, core, [10, 20, 99]),
        accessLink(core, ap, 10),
        accessLink(core, pc1, 10),
        accessLink(core, pc2, 20),
        accessLink(core, printer, 20),
      ]

      nodes[fw].x = 400; nodes[fw].y = 50
      nodes[core].x = 400; nodes[core].y = 200
      nodes[ap].x = 200; nodes[ap].y = 320
      nodes[pc1].x = 350; nodes[pc1].y = 350
      nodes[pc2].x = 500; nodes[pc2].y = 350
      nodes[printer].x = 600; nodes[printer].y = 320

      return { nodes, links }
    },
  },

  {
    name: '数据中心 Spine-Leaf',
    description: 'Spine-Leaf 架构，适用于数据中心/私有云（高带宽、低延迟）',
    icon: '☁️',
    generate() {
      resetCounter()
      const spine1 = key('Spine')
      const spine2 = key('Spine')
      const leaf1 = key('Leaf')
      const leaf2 = key('Leaf')
      const leaf3 = key('Leaf')
      const leaf4 = key('Leaf')
      const srv1 = key('Server')
      const srv2 = key('Server')
      const srv3 = key('Server')
      const srv4 = key('Server')

      const nodes = {
        [spine1]: switchNode({ label: 'Spine-1', role: 'core', zone: '内部网络' }),
        [spine2]: switchNode({ label: 'Spine-2', role: 'core', zone: '内部网络' }),
        [leaf1]: switchNode({ label: 'Leaf-1', role: 'aggregation', zone: '内部网络' }),
        [leaf2]: switchNode({ label: 'Leaf-2', role: 'aggregation', zone: '内部网络' }),
        [leaf3]: switchNode({ label: 'Leaf-3', role: 'aggregation', zone: '内部网络' }),
        [leaf4]: switchNode({ label: 'Leaf-4', role: 'aggregation', zone: '内部网络' }),
        [srv1]: endpointNode({ label: 'App-Server-1' }),
        [srv2]: endpointNode({ label: 'App-Server-2' }),
        [srv3]: endpointNode({ label: 'DB-Server-1' }),
        [srv4]: endpointNode({ label: 'DB-Server-2' }),
      }

      const links = [
        trunkLink(spine1, leaf1, [10]),
        trunkLink(spine1, leaf2, [10]),
        trunkLink(spine1, leaf3, [20]),
        trunkLink(spine1, leaf4, [20]),
        trunkLink(spine2, leaf1, [10]),
        trunkLink(spine2, leaf2, [10]),
        trunkLink(spine2, leaf3, [20]),
        trunkLink(spine2, leaf4, [20]),
        accessLink(leaf1, srv1, 10),
        accessLink(leaf2, srv2, 10),
        accessLink(leaf3, srv3, 20),
        accessLink(leaf4, srv4, 20),
      ]

      nodes[spine1].x = 350; nodes[spine1].y = 50
      nodes[spine2].x = 500; nodes[spine2].y = 50
      nodes[leaf1].x = 100; nodes[leaf1].y = 200
      nodes[leaf2].x = 350; nodes[leaf2].y = 200
      nodes[leaf3].x = 500; nodes[leaf3].y = 200
      nodes[leaf4].x = 750; nodes[leaf4].y = 200
      nodes[srv1].x = 50; nodes[srv1].y = 350
      nodes[srv2].x = 250; nodes[srv2].y = 350
      nodes[srv3].x = 500; nodes[srv3].y = 350
      nodes[srv4].x = 700; nodes[srv4].y = 350

      return { nodes, links }
    },
  },
]

export function getTemplates() {
  return templates
}

export function getTemplateByName(name) {
  return templates.find(t => t.name === name)
}
