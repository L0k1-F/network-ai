/**
 * Lightweight network device simulator — eNSP-style CLI with real state.
 * Supports Huawei VRP-like and Cisco IOS-like CLI dialects.
 */

// ---- Helpers ----
function _vendorStyle(vendor) {
  const v = (vendor || 'Huawei').toLowerCase()
  if (['huawei', 'h3c', 'maipu', 'fiberhome', 'juniper', 'hpe', 'extreme', 'sonic'].includes(v)) return 'huawei'
  return 'cisco'
}

function _defaultIntfs(category) {
  const names = []
  if (category === 'router') {
    for (let i = 0; i < 4; i++) names.push(`GigabitEthernet0/0/${i}`)
  } else if (category === 'firewall' || category === 'ips') {
    for (let i = 0; i < 6; i++) names.push(`GigabitEthernet0/0/${i}`)
  } else if (category === 'switch' || category === 'dumb-switch') {
    for (let i = 1; i <= 10; i++) names.push(`GigabitEthernet0/0/${i}`)
  } else if (category === 'server' || category === 'nvr') {
    for (let i = 0; i < 2; i++) names.push(`Ethernet0/0/${i}`)
  } else {
    // pc, laptop, camera, phone, printer, ap, cloud — single port
    names.push('Ethernet0/0/0')
  }
  return names
}

function _fmtTable(headers, rows, colWidths) {
  const lines = []
  const sep = colWidths.map(w => '-'.repeat(w)).join('  ')
  lines.push(headers.map((h, i) => h.padEnd(colWidths[i])).join('  '))
  lines.push(sep)
  for (const row of rows) {
    lines.push(row.map((c, i) => (c || '').padEnd(colWidths[i])).join('  '))
  }
  return lines
}

function _now() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`
}

// ==================== DeviceSimulator ====================

export class DeviceSimulator {
  constructor(vendor, hostname, category = 'switch') {
    this.vendor = vendor || 'Huawei'
    this.hostname = hostname || 'Device'
    this.category = category
    this.style = _vendorStyle(this.vendor)
    this.bootTime = _now()

    // VLAN state
    this.vlans = new Map()
    this.vlans.set(1, { name: 'default', description: 'Default VLAN', ports: new Set() })

    // Interface state
    this.interfaces = new Map()
    const names = _defaultIntfs(category)
    for (const n of names) {
      this.interfaces.set(n, {
        status: 'up', proto: 'up',
        mode: 'access', accessVlan: 1,
        trunkVlans: [], nativeVlan: 1,
        ip: '', mask: '',
        description: '',
      })
      this.vlans.get(1).ports.add(n)
    }

    // Routing
    this.staticRoutes = []
    this.ospf = null  // { pid, routerId, networks: [], areas: [] }

    // Features
    this.stpEnabled = false
    this.stpMode = 'rstp'
    this.dhcpEnabled = false
    this.dhcpPools = []  // [{ name, network, mask, gateway, dns, excluded: [] }]
    this.acls = []  // [{ num, rules: [{action, src, wildcard, dst, dstWildcard}] }]

    // Session stats
    this.cmdCount = 0
  }

  // ---- Core execute ----
  execute(rawCmd, currentMode, subContext) {
    const cmd = rawCmd.trim()
    this.cmdCount++
    if (!cmd) return { output: [''], newMode: currentMode, newSubContext: subContext }

    const lower = cmd.toLowerCase()
    const parts = cmd.split(/\s+/)
    const first = parts[0].toLowerCase()
    const s = this.style

    // --- Global commands (any mode) ---
    if (lower === '?' || lower === 'help') {
      return { output: this._help(currentMode), newMode: currentMode, newSubContext: subContext }
    }
    if (lower === 'clear' || lower === 'cls') {
      return { output: ['__CLEAR__'], newMode: currentMode, newSubContext: subContext }
    }

    // --- Mode switching ---
    const enterCfg = s === 'huawei' ? 'system-view' : 'configure terminal'
    if (lower === enterCfg || lower === 'conf t') {
      if (currentMode === 'user') return { output: ['Enter configuration mode.'], newMode: 'system', newSubContext: '' }
      return { output: [`% Already in configuration mode.`], newMode: currentMode, newSubContext: subContext }
    }
    if (lower === 'quit' || lower === 'exit') {
      if (currentMode === 'system') return { output: ['Return to user view.'], newMode: 'user', newSubContext: '' }
      if (currentMode !== 'user') return { output: ['Return to system view.'], newMode: 'system', newSubContext: '' }
      return { output: ['% Already at top level.'], newMode: currentMode, newSubContext: subContext }
    }
    if ((s === 'huawei' && lower === 'return') || lower === 'end') {
      return { output: ['Return to user view.'], newMode: 'user', newSubContext: '' }
    }
    // Ctrl+C interrupt simulation
    if (lower === '^c') {
      if (currentMode !== 'user') return { output: ['Interrupted. Return to user view.'], newMode: 'user', newSubContext: '' }
      return { output: [''], newMode: currentMode, newSubContext: subContext }
    }

    // --- Display / Show (user & system mode) ---
    if ((s === 'huawei' && first === 'display') || (s === 'cisco' && first === 'show')) {
      return this._handleDisplay(cmd, currentMode, subContext)
    }

    // --- Ping ---
    if (first === 'ping' && currentMode === 'user') {
      return this._handlePing(cmd)
    }

    // ---- System view commands ----
    if (currentMode === 'system') {
      return this._handleSystem(cmd, parts, lower, s)
    }

    // ---- Interface view commands ----
    if (currentMode === 'interface' && subContext) {
      return this._handleInterface(cmd, parts, lower, s, subContext)
    }

    // ---- VLAN view commands ----
    if (currentMode === 'vlan' && subContext) {
      return this._handleVlanView(cmd, parts, lower, s, subContext)
    }

    // ---- OSPF view commands ----
    if (currentMode === 'ospf' && subContext) {
      return this._handleOspfView(cmd, parts, lower, s, subContext)
    }

    // ---- User view fallback ----
    if (currentMode === 'user') {
      return { output: [`% Unknown command: "${cmd}". Type ? for available commands. Use ${enterCfg} to configure.`], newMode: currentMode, newSubContext: subContext }
    }

    return { output: [cmd], newMode: currentMode, newSubContext: subContext }
  }

  // ==================== DISPLAY HANDLERS ====================

  _handleDisplay(cmd, mode, subCtx) {
    const lower = cmd.toLowerCase()
    const s = this.style
    const showCfg = s === 'huawei' ? 'display current-configuration' : 'show running-config'

    if (lower === showCfg || lower === 'sh run') {
      return { output: this._genRunningConfig(), newMode: mode, newSubContext: subCtx }
    }
    if (lower.includes('vlan') && !lower.includes('vlanif') && !lower.includes('vlan-if')) {
      return { output: this._genVlanTable(), newMode: mode, newSubContext: subCtx }
    }
    if (lower.includes('interface brief') || lower.includes('ip interface brief')) {
      return { output: this._genInterfaceBrief(), newMode: mode, newSubContext: subCtx }
    }
    if (lower.includes('ip routing-table') || lower.includes('ip route')) {
      return { output: this._genRouteTable(), newMode: mode, newSubContext: subCtx }
    }
    if (lower.includes('version')) {
      return { output: this._genVersion(), newMode: mode, newSubContext: subCtx }
    }
    if (lower.includes('this')) {
      return { output: this._genDisplayThis(mode, subCtx), newMode: mode, newSubContext: subCtx }
    }
    if (lower.includes('cpu')) {
      return { output: [`CPU Usage: ${Math.floor(Math.random() * 15 + 3)}%  (1 min avg)`], newMode: mode, newSubContext: subCtx }
    }
    if (lower.includes('memory')) {
      return { output: [`Memory Usage: ${Math.floor(Math.random() * 30 + 20)}%  Total: 512MB  Used: ${Math.floor(Math.random() * 100 + 100)}MB  Free: ${Math.floor(Math.random() * 200 + 200)}MB`], newMode: mode, newSubContext: subCtx }
    }
    if (lower.includes('stp') && lower.includes('brief')) {
      return this._genStpBrief(mode, subCtx)
    }
    if (lower.includes('ospf') && lower.includes('peer')) {
      return this._genOspfPeer(mode, subCtx)
    }
    if (lower.includes('lldp') && lower.includes('neighbor')) {
      return { output: ['No LLDP neighbors found.'], newMode: mode, newSubContext: subCtx }
    }
    if (lower.includes('clock') || lower.includes('time')) {
      return { output: [`Current time: ${_now()}`], newMode: mode, newSubContext: subCtx }
    }
    // Generic display — not recognized but we give a hint
    return { output: [`% Unrecognized display command: "${cmd}"`, `  Try: display vlan | display interface brief | display current-configuration | display this`], newMode: mode, newSubContext: subCtx }
  }

  // ==================== SYSTEM VIEW ====================

  _handleSystem(cmd, parts, lower, style) {
    const first = parts[0].toLowerCase()
    const enterCfg = style === 'huawei' ? 'system-view' : 'configure terminal'

    // Hostname
    if ((style === 'huawei' && first === 'sysname') || (style === 'cisco' && first === 'hostname')) {
      const name = parts.slice(1).join(' ')
      if (!name) return { output: ['% Incomplete command.'], newMode: 'system', newSubContext: '' }
      this.hostname = name
      return { output: [''], newMode: 'system', newSubContext: '' }
    }

    // VLAN creation
    if (first === 'vlan') {
      if (style === 'huawei' && parts[1] === 'batch') {
        // vlan batch 10 20 30
        const ids = parts.slice(2).filter(p => /^\d+$/.test(p)).map(Number)
        for (const id of ids) this._ensureVlan(id)
        return { output: [''], newMode: 'vlan', newSubContext: String(ids[ids.length - 1] || 1) }
      }
      const vlanId = parseInt(parts[1])
      if (isNaN(vlanId) || vlanId < 1 || vlanId > 4094) return { output: ['% Invalid VLAN ID. Range: 1-4094.'], newMode: 'system', newSubContext: '' }
      this._ensureVlan(vlanId)
      if (style === 'cisco') return { output: [`VLAN ${vlanId} added.`], newMode: 'vlan', newSubContext: String(vlanId) }
      return { output: [''], newMode: 'vlan', newSubContext: String(vlanId) }
    }

    // Interface
    if (first === 'interface') {
      const ifname = parts.slice(1).join(' ')
      if (!ifname) return { output: ['% Incomplete command.'], newMode: 'system', newSubContext: '' }
      this._ensureInterface(ifname)
      return { output: [''], newMode: 'interface', newSubContext: ifname }
    }

    // STP
    if (first === 'stp' || first === 'spanning-tree') {
      if (lower.includes('enable') || lower === 'spanning-tree') {
        this.stpEnabled = true
        if (style === 'huawei') {
          if (lower.includes('mode rstp')) this.stpMode = 'rstp'
          else if (lower.includes('mode mstp')) this.stpMode = 'mstp'
        }
        return { output: [''], newMode: 'system', newSubContext: '' }
      }
      return { output: [cmd], newMode: 'system', newSubContext: '' }
    }

    // DHCP
    if (first === 'dhcp' && lower.includes('enable')) {
      this.dhcpEnabled = true
      return { output: [''], newMode: 'system', newSubContext: '' }
    }

    // IP route-static / ip route
    if ((style === 'huawei' && first === 'ip' && parts[1] === 'route-static') || (style === 'cisco' && first === 'ip' && parts[1] === 'route')) {
      const isHw = style === 'huawei'
      const dest = isHw ? parts[2] : parts[2]
      const mask = isHw ? parts[3] : parts[3]
      const nh = isHw ? parts[4] : parts[4]
      if (!dest || !mask || !nh) return { output: ['% Incomplete command. Syntax: ip route-static <dest> <mask> <next-hop>'], newMode: 'system', newSubContext: '' }
      this.staticRoutes.push({ dest, mask, nextHop: nh, type: 'static' })
      return { output: [''], newMode: 'system', newSubContext: '' }
    }

    // OSPF
    if ((style === 'huawei' && first === 'ospf') || (style === 'cisco' && first === 'router' && parts[1] === 'ospf')) {
      const pid = style === 'huawei' ? parseInt(parts[1]) : parseInt(parts[2])
      if (isNaN(pid)) return { output: ['% Invalid OSPF process ID.'], newMode: 'system', newSubContext: '' }
      this.ospf = this.ospf || { pid, routerId: '', networks: [], areas: [] }
      return { output: [''], newMode: 'ospf', newSubContext: String(pid) }
    }

    // ACL
    if ((style === 'huawei' && first === 'acl') || (style === 'cisco' && first === 'access-list')) {
      return { output: [cmd], newMode: 'system', newSubContext: '' }
    }

    // Undo / No
    if (first === 'undo' || first === 'no') {
      return { output: ['Configuration removed.'], newMode: 'system', newSubContext: '' }
    }

    // Save
    if ((style === 'huawei' && lower === 'save') || (style === 'cisco' && (lower === 'write' || lower === 'copy running-config startup-config'))) {
      return { output: ['Configuration saved successfully.'], newMode: 'system', newSubContext: '' }
    }

    // Display/show also works in system view
    if ((style === 'huawei' && first === 'display') || (style === 'cisco' && first === 'show')) {
      return this._handleDisplay(cmd, 'system', '')
    }

    // Ping works in system view too
    if (first === 'ping') return this._handlePing(cmd)

    return { output: [cmd], newMode: 'system', newSubContext: '' }
  }

  // ==================== INTERFACE VIEW ====================

  _handleInterface(cmd, parts, lower, style, ifname) {
    const first = parts[0].toLowerCase()
    const intf = this.interfaces.get(ifname)
    if (!intf) return { output: ['% Interface not found.'], newMode: 'interface', newSubContext: ifname }

    if (style === 'huawei') {
      if (first === 'port') {
        if (lower.includes('link-type access')) {
          intf.mode = 'access'
          return { output: [''], newMode: 'interface', newSubContext: ifname }
        }
        if (lower.includes('link-type trunk')) {
          intf.mode = 'trunk'
          return { output: [''], newMode: 'interface', newSubContext: ifname }
        }
        if (lower.includes('default vlan')) {
          const vlan = parseInt(parts[parts.length - 1])
          if (isNaN(vlan)) return { output: ['% Invalid VLAN ID.'], newMode: 'interface', newSubContext: ifname }
          if (intf.mode !== 'access') return { output: ['% Port must be in access mode first.'], newMode: 'interface', newSubContext: ifname }
          // Remove from old VLAN
          const oldVlan = this.vlans.get(intf.accessVlan)
          if (oldVlan) oldVlan.ports.delete(ifname)
          intf.accessVlan = vlan
          this._ensureVlan(vlan)
          this.vlans.get(vlan).ports.add(ifname)
          return { output: [''], newMode: 'interface', newSubContext: ifname }
        }
        if (lower.includes('trunk allow-pass')) {
          const vlanPart = parts.slice(parts.indexOf('allow-pass') + 1).join(' ')
          const vlans = vlanPart.split(/\s+/).filter(p => /^\d+$/.test(p)).map(Number)
          intf.trunkVlans = vlans
          for (const v of vlans) this._ensureVlan(v)
          return { output: [''], newMode: 'interface', newSubContext: ifname }
        }
        if (lower.includes('trunk pvid')) {
          const vlan = parseInt(parts[parts.length - 1])
          if (isNaN(vlan)) return { output: ['% Invalid VLAN ID.'], newMode: 'interface', newSubContext: ifname }
          intf.nativeVlan = vlan
          this._ensureVlan(vlan)
          return { output: [''], newMode: 'interface', newSubContext: ifname }
        }
      }
    } else {
      // Cisco-like
      if (first === 'switchport') {
        if (lower.includes('mode access')) {
          intf.mode = 'access'
          return { output: [''], newMode: 'interface', newSubContext: ifname }
        }
        if (lower.includes('mode trunk')) {
          intf.mode = 'trunk'
          return { output: [''], newMode: 'interface', newSubContext: ifname }
        }
        if (lower.includes('access vlan')) {
          const vlan = parseInt(parts[parts.length - 1])
          if (isNaN(vlan)) return { output: ['% Invalid VLAN ID.'], newMode: 'interface', newSubContext: ifname }
          const oldVlan = this.vlans.get(intf.accessVlan)
          if (oldVlan) oldVlan.ports.delete(ifname)
          intf.accessVlan = vlan
          this._ensureVlan(vlan)
          this.vlans.get(vlan).ports.add(ifname)
          return { output: [''], newMode: 'interface', newSubContext: ifname }
        }
        if (lower.includes('trunk allowed vlan')) {
          const vlanPart = parts.slice(parts.indexOf('vlan') + 1).join('')
          const vlans = vlanPart.split(',').map(s => s.trim()).filter(s => /^\d+/.test(s)).map(Number)
          intf.trunkVlans = vlans
          for (const v of vlans) this._ensureVlan(v)
          return { output: [''], newMode: 'interface', newSubContext: ifname }
        }
        if (lower.includes('trunk native vlan')) {
          const vlan = parseInt(parts[parts.length - 1])
          if (isNaN(vlan)) return { output: ['% Invalid VLAN ID.'], newMode: 'interface', newSubContext: ifname }
          intf.nativeVlan = vlan
          return { output: [''], newMode: 'interface', newSubContext: ifname }
        }
      }
    }

    // IP address
    if (first === 'ip' && parts[1] === 'address') {
      const addr = parts[2]
      const mask = parts[3]
      if (!addr || !mask) return { output: ['% Incomplete command.'], newMode: 'interface', newSubContext: ifname }
      intf.ip = addr
      intf.mask = mask
      return { output: [''], newMode: 'interface', newSubContext: ifname }
    }

    // Description
    if (first === 'description') {
      intf.description = parts.slice(1).join(' ')
      return { output: [''], newMode: 'interface', newSubContext: ifname }
    }

    // Shutdown / no shutdown
    if (first === 'shutdown') {
      intf.status = 'down'
      intf.proto = 'down'
      return { output: [''], newMode: 'interface', newSubContext: ifname }
    }
    if (lower === 'undo shutdown' || lower === 'no shutdown') {
      intf.status = 'up'
      intf.proto = 'up'
      return { output: [''], newMode: 'interface', newSubContext: ifname }
    }

    // STP edge
    if ((style === 'huawei' && lower.includes('stp edged-port')) || (style === 'cisco' && lower.includes('spanning-tree portfast'))) {
      return { output: [''], newMode: 'interface', newSubContext: ifname }
    }

    // Display this
    if (first === 'display' || first === 'show') {
      return this._handleDisplay(cmd, 'interface', ifname)
    }

    // Undo/No
    if (first === 'undo' || first === 'no') {
      return { output: ['Configuration removed.'], newMode: 'interface', newSubContext: ifname }
    }

    return { output: [cmd], newMode: 'interface', newSubContext: ifname }
  }

  // ==================== VLAN VIEW ====================

  _handleVlanView(cmd, parts, lower, style, vlanId) {
    const first = parts[0].toLowerCase()
    const vlan = this.vlans.get(parseInt(vlanId))
    if (!vlan) return { output: ['% VLAN not found.'], newMode: 'vlan', newSubContext: vlanId }

    if (first === 'name') {
      vlan.name = parts.slice(1).join(' ')
      return { output: [''], newMode: 'vlan', newSubContext: vlanId }
    }
    if (first === 'description') {
      vlan.description = parts.slice(1).join(' ')
      return { output: [''], newMode: 'vlan', newSubContext: vlanId }
    }
    if (first === 'display' || first === 'show') {
      return this._handleDisplay(cmd, 'vlan', vlanId)
    }
    if (first === 'undo' || first === 'no') {
      return { output: ['Configuration removed.'], newMode: 'vlan', newSubContext: vlanId }
    }
    return { output: [cmd], newMode: 'vlan', newSubContext: vlanId }
  }

  // ==================== OSPF VIEW ====================

  _handleOspfView(cmd, parts, lower, style, pid) {
    const first = parts[0].toLowerCase()
    if (!this.ospf) this.ospf = { pid: parseInt(pid), routerId: '', networks: [], areas: [] }

    if (first === 'area') {
      const areaId = parts[1]
      if (!areaId) return { output: ['% Incomplete command.'], newMode: 'ospf', newSubContext: pid }
      const existing = this.ospf.areas.find(a => a.id === areaId)
      if (!existing) this.ospf.areas.push({ id: areaId, networks: [] })
      return { output: [''], newMode: 'ospf', newSubContext: pid }
    }
    if (first === 'network' && style === 'huawei') {
      const net = parts[1], wildcard = parts[2]
      if (!net || !wildcard) return { output: ['% Incomplete command.'], newMode: 'ospf', newSubContext: pid }
      this.ospf.networks.push({ net, wildcard, area: this.ospf.areas[this.ospf.areas.length - 1]?.id || '0' })
      return { output: [''], newMode: 'ospf', newSubContext: pid }
    }
    if (first === 'network' && style === 'cisco') {
      // network N.N.N.N W.W.W.W area A
      const net = parts[1], wildcard = parts[2], area = parts[4] || '0'
      if (!net || !wildcard) return { output: ['% Incomplete command.'], newMode: 'ospf', newSubContext: pid }
      this.ospf.networks.push({ net, wildcard, area })
      return { output: [''], newMode: 'ospf', newSubContext: pid }
    }
    if (first === 'router-id') {
      this.ospf.routerId = parts[1] || ''
      return { output: [''], newMode: 'ospf', newSubContext: pid }
    }
    if (first === 'display' || first === 'show') {
      return this._handleDisplay(cmd, 'ospf', pid)
    }
    return { output: [cmd], newMode: 'ospf', newSubContext: pid }
  }

  // ==================== DISPLAY GENERATORS ====================

  _genVlanTable() {
    const rows = []
    for (const [id, v] of this.vlans) {
      const ports = [...v.ports].join(' ') || '-'
      rows.push([String(id), v.name || `VLAN${String(id).padStart(4,'0')}`, 'active', ports])
    }
    return _fmtTable(['VLAN ID', 'Name', 'Status', 'Ports'], rows, [8, 14, 8, 30])
  }

  _genInterfaceBrief() {
    const rows = []
    for (const [name, intf] of this.interfaces) {
      const ip = intf.ip ? `${intf.ip}/${this._maskToPrefix(intf.mask)}` : '--'
      rows.push([name, intf.status, intf.proto, ip, intf.description || ''])
    }
    return _fmtTable(['Interface', 'PHY', 'Protocol', 'IP Address', 'Description'], rows, [26, 5, 8, 18, 20])
  }

  _genRouteTable() {
    const lines = []
    lines.push('Destination/Mask    Proto   Pre   Cost   NextHop         Interface')
    lines.push('---------------------------------------------------------------------------')
    // Direct routes for interface IPs
    for (const [name, intf] of this.interfaces) {
      if (intf.ip) {
        const prefix = this._maskToPrefix(intf.mask)
        lines.push(`${intf.ip}/${prefix}  Direct  0     0      ${intf.ip}        ${name}`)
      }
    }
    for (const r of this.staticRoutes) {
      lines.push(`${r.dest}/${this._maskToPrefix(r.mask)}  Static  60    0      ${r.nextHop}        -`)
    }
    if (this.ospf) {
      for (const n of this.ospf.networks) {
        lines.push(`${n.net}/${this._maskToPrefix(n.wildcard)}  OSPF    10    0      -               -`)
      }
    }
    if (lines.length <= 2) lines.push('(no routes configured)')
    return lines
  }

  _genRunningConfig() {
    const s = this.style
    const lines = []
    const enter = s === 'huawei' ? 'system-view' : 'configure terminal'
    const showCmd = s === 'huawei' ? 'display current-configuration' : 'show running-config'

    lines.push(`! ${this.vendor} device configuration`)
    lines.push(`! Generated: ${_now()}`)
    lines.push(`!`)
    if (s === 'huawei') {
      lines.push('#')
      lines.push(`sysname ${this.hostname}`)
      lines.push('#')
    } else {
      lines.push(`hostname ${this.hostname}`)
      lines.push(`!`)
    }

    // VLANs
    const nonDefaultVlans = [...this.vlans.entries()].filter(([id]) => id !== 1)
    if (nonDefaultVlans.length > 0) {
      const ids = nonDefaultVlans.map(([id]) => id).join(' ')
      if (s === 'huawei') lines.push(`vlan batch ${ids}`)
      else for (const [id] of nonDefaultVlans) lines.push(`vlan ${id}`)
      lines.push('#')
    }

    // STP
    if (this.stpEnabled) {
      if (s === 'huawei') {
        lines.push('stp enable')
        lines.push(`stp mode ${this.stpMode}`)
      } else {
        lines.push('spanning-tree')
        lines.push(`spanning-tree mode ${this.stpMode === 'mstp' ? 'mst' : 'rapid-pvst'}`)
      }
      lines.push('#')
    }

    // Interfaces
    for (const [name, intf] of this.interfaces) {
      const hasConfig = intf.mode !== 'access' || intf.accessVlan !== 1 || intf.ip || intf.description
      if (!hasConfig) continue
      lines.push(`interface ${name}`)
      if (intf.description) lines.push(` description ${intf.description}`)
      if (s === 'huawei') {
        if (intf.mode === 'trunk') {
          lines.push(' port link-type trunk')
          if (intf.trunkVlans.length) lines.push(` port trunk allow-pass vlan ${intf.trunkVlans.join(' ')}`)
          if (intf.nativeVlan !== 1) lines.push(` port trunk pvid vlan ${intf.nativeVlan}`)
        } else {
          lines.push(' port link-type access')
          lines.push(` port default vlan ${intf.accessVlan}`)
        }
        if (intf.ip) {
          lines.push(` ip address ${intf.ip} ${intf.mask}`)
        }
      } else {
        if (intf.mode === 'trunk') {
          lines.push(' switchport mode trunk')
          if (intf.trunkVlans.length) lines.push(` switchport trunk allowed vlan ${intf.trunkVlans.join(',')}`)
          if (intf.nativeVlan !== 1) lines.push(` switchport trunk native vlan ${intf.nativeVlan}`)
        } else {
          lines.push(' switchport mode access')
          lines.push(` switchport access vlan ${intf.accessVlan}`)
        }
        if (intf.ip) lines.push(` ip address ${intf.ip} ${intf.mask}`)
      }
      lines.push('#')
    }

    // Static routes
    for (const r of this.staticRoutes) {
      lines.push(s === 'huawei' ? `ip route-static ${r.dest} ${r.mask} ${r.nextHop}` : `ip route ${r.dest} ${r.mask} ${r.nextHop}`)
    }

    // OSPF
    if (this.ospf) {
      lines.push('#')
      if (s === 'huawei') {
        lines.push(`ospf ${this.ospf.pid} router-id ${this.ospf.routerId || '0.0.0.0'}`)
        for (const n of this.ospf.networks) {
          lines.push(` area ${n.area}`)
          lines.push(`  network ${n.net} ${n.wildcard}`)
        }
      } else {
        lines.push(`router ospf ${this.ospf.pid}`)
        if (this.ospf.routerId) lines.push(` router-id ${this.ospf.routerId}`)
        for (const n of this.ospf.networks) {
          lines.push(` network ${n.net} ${n.wildcard} area ${n.area}`)
        }
      }
    }

    if (s === 'huawei') {
      lines.push('#')
      lines.push('return')
    } else {
      lines.push('end')
    }

    return lines
  }

  _genVersion() {
    return [
      `${this.vendor} Device Software`,
      `Hostname: ${this.hostname}`,
      `Version: V200R020C10SPC600`,
      `Uptime: ${this.cmdCount} commands executed since boot`,
      `Boot Time: ${this.bootTime}`,
      `Device Type: ${this.category}`,
    ]
  }

  _genDisplayThis(mode, subCtx) {
    const lines = []
    if (mode === 'interface' && subCtx) {
      const intf = this.interfaces.get(subCtx)
      if (intf) {
        lines.push(`interface ${subCtx}`)
        if (intf.description) lines.push(` description ${intf.description}`)
        if (this.style === 'huawei') {
          lines.push(` port link-type ${intf.mode}`)
          if (intf.mode === 'access') lines.push(` port default vlan ${intf.accessVlan}`)
          else lines.push(` port trunk allow-pass vlan ${intf.trunkVlans.join(' ')}`)
        } else {
          lines.push(` switchport mode ${intf.mode}`)
          if (intf.mode === 'access') lines.push(` switchport access vlan ${intf.accessVlan}`)
          else lines.push(` switchport trunk allowed vlan ${intf.trunkVlans.join(',')}`)
        }
        if (intf.ip) lines.push(` ip address ${intf.ip} ${intf.mask}`)
      }
    } else if (mode === 'vlan' && subCtx) {
      const vlan = this.vlans.get(parseInt(subCtx))
      if (vlan) {
        lines.push(`vlan ${subCtx}`)
        lines.push(` name ${vlan.name}`)
        if (vlan.description) lines.push(` description ${vlan.description}`)
      }
    } else if (mode === 'system' || mode === 'user') {
      return this._genRunningConfig()
    }
    if (!lines.length) lines.push('(no configuration in current view)')
    lines.push('return' ? (this.style === 'huawei' ? 'return' : 'end') : '')
    return lines
  }

  _genStpBrief(mode, subCtx) {
    if (!this.stpEnabled) return { output: ['STP is not enabled.'], newMode: mode, newSubContext: subCtx }
    const rows = []
    for (const [name, intf] of this.interfaces) {
      const role = intf.status === 'up' ? 'DESI' : 'DISABLED'
      const state = intf.status === 'up' ? 'FORWARDING' : 'DISCARDING'
      rows.push([name, role, state, '-', '-'])
    }
    const lines = _fmtTable(['Port', 'Role', 'State', 'Cost', 'Edge'], rows, [26, 8, 12, 6, 6])
    return { output: lines, newMode: mode, newSubContext: subCtx }
  }

  _genOspfPeer(mode, subCtx) {
    if (!this.ospf) return { output: ['OSPF is not configured.'], newMode: mode, newSubContext: subCtx }
    return { output: ['OSPF Process ' + this.ospf.pid, 'No neighbors established (simulation).'], newMode: mode, newSubContext: subCtx }
  }

  // ==================== PING ====================

  _handlePing(cmd) {
    const match = cmd.match(/ping\s+(\S+)/i)
    if (!match) return { output: ['% Incomplete command. Usage: ping <ip-address>'], newMode: 'user', newSubContext: '' }
    const ip = match[1]
    const time = Math.floor(Math.random() * 5) + 1
    return {
      output: [
        `PING ${ip}: 56 data bytes, press CTRL_C to break`,
        `    Reply from ${ip}: bytes=56 Sequence=1 ttl=255 time=${time}ms`,
        `    Reply from ${ip}: bytes=56 Sequence=2 ttl=255 time=${Math.max(1, time - 1)}ms`,
        `    Reply from ${ip}: bytes=56 Sequence=3 ttl=255 time=${time}ms`,
        `    Reply from ${ip}: bytes=56 Sequence=4 ttl=255 time=${time + 1}ms`,
        `    Reply from ${ip}: bytes=56 Sequence=5 ttl=255 time=${time}ms`,
        ``,
        `  --- ${ip} ping statistics ---`,
        `    5 packet(s) transmitted`,
        `    5 packet(s) received`,
        `    0.00% packet loss`,
        `    round-trip min/avg/max = ${Math.max(1, time - 1)}/${time}/${time + 1} ms`,
      ],
      newMode: 'user',
      newSubContext: ''
    }
  }

  // ==================== HELP ====================

  _help(mode) {
    const s = this.style
    const enter = s === 'huawei' ? 'system-view' : 'configure terminal'
    const show = s === 'huawei' ? 'display' : 'show'

    const cmds = []
    cmds.push(`--- ${this.vendor} CLI Help (${mode} mode) ---`)
    cmds.push('')

    if (mode === 'user') {
      cmds.push(`${enter}          Enter system view`)
      cmds.push(`${show} vlan            Show VLAN information`)
      cmds.push(`${show} interface brief Show interface status`)
      cmds.push(`${show} current-configuration  Show running config`)
      cmds.push(`ping <ip>         Test connectivity`)
      cmds.push(`quit              Exit`)
    } else if (mode === 'system') {
      cmds.push(`${s === 'huawei' ? 'sysname' : 'hostname'} <name>   Set device hostname`)
      cmds.push(`vlan <id>               Create VLAN and enter VLAN view`)
      cmds.push(`vlan batch <ids>        Create multiple VLANs (Huawei)`)
      cmds.push(`interface <name>        Enter interface view`)
      cmds.push(`${s === 'huawei' ? 'stp enable' : 'spanning-tree'}          Enable STP`)
      cmds.push(`ip route-static ...     Add static route`)
      cmds.push(`ospf <pid>              Enter OSPF view`)
      cmds.push(`quit                    Return to user view`)
    } else if (mode === 'interface') {
      cmds.push(`${s === 'huawei' ? 'port link-type access|trunk' : 'switchport mode access|trunk'}`)
      cmds.push(`${s === 'huawei' ? 'port default vlan <id>' : 'switchport access vlan <id>'}`)
      cmds.push(`ip address <ip> <mask>  Set IP address`)
      cmds.push(`description <text>      Set description`)
      cmds.push(`quit                    Return to system view`)
    } else if (mode === 'vlan') {
      cmds.push(`name <name>             Set VLAN name`)
      cmds.push(`description <text>      Set description`)
      cmds.push(`quit                    Return to system view`)
    } else if (mode === 'ospf') {
      cmds.push(`area <id>               Enter area view`)
      cmds.push(`network <ip> <wildcard> Add network to area`)
      cmds.push(`router-id <ip>          Set router ID`)
      cmds.push(`quit                    Return to system view`)
    }

    cmds.push('')
    cmds.push(`Tab=Complete  ArrowUp/Down=History  ?=Help  Ctrl+C=Interrupt  clear=ClearScreen`)
    return cmds
  }

  // ==================== UTILITIES ====================

  _ensureVlan(id) {
    if (!this.vlans.has(id)) {
      this.vlans.set(id, { name: `VLAN${String(id).padStart(4, '0')}`, description: '', ports: new Set() })
    }
  }

  _ensureInterface(name) {
    if (!this.interfaces.has(name)) {
      this.interfaces.set(name, {
        status: 'up', proto: 'up',
        mode: 'access', accessVlan: 1,
        trunkVlans: [], nativeVlan: 1,
        ip: '', mask: '',
        description: '',
      })
      this.vlans.get(1).ports.add(name)
    }
  }

  _maskToPrefix(mask) {
    if (!mask) return '24'
    try {
      const bits = mask.split('.').reduce((acc, oct) => {
        const n = parseInt(oct) || 0
        return acc + (n.toString(2).match(/1/g) || []).length
      }, 0)
      return String(bits)
    } catch (_) { return '24' }
  }

  /** Get the complete running-config as an array of config lines */
  getRunningConfig() {
    return this._genRunningConfig()
  }

  /** Export device state as structured config suitable for the API */
  exportConfig() {
    return this.getRunningConfig()
  }
}
