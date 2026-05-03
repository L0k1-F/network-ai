/**
 * Topology validation engine.
 * Returns warnings array: [{ severity, device, deviceLabel, message, fix }]
 */
export function validateTopology(topoData) {
  const warnings = []
  const { nodes, links } = topoData

  if (!nodes || !links) return warnings

  const nodeMap = {}
  for (const [key, node] of Object.entries(nodes)) {
    nodeMap[key] = {
      ...node,
      _key: key,
      _vlanSet: new Set(),
      _linkCount: 0,
      _peerRoles: new Set(),
    }
  }

  // Build link-derived data per node
  for (const link of links) {
    const from = nodeMap[link.from]
    const to = nodeMap[link.to]
    if (!from || !to) continue

    from._linkCount++
    to._linkCount++

    from._peerRoles.add(to.role)
    to._peerRoles.add(from.role)

    // Collect VLANs
    if (link.accessVlan) {
      from._vlanSet.add(link.accessVlan)
      if (link.mode !== 'trunk') to._vlanSet.add(link.accessVlan)
    }
    for (const v of link.allowedVlans || []) {
      const vi = typeof v === 'string' ? parseInt(v, 10) : v
      if (!isNaN(vi)) {
        from._vlanSet.add(vi)
        to._vlanSet.add(vi)
      }
    }
  }

  const isSwitch = (r) => r === 'core' || r === 'aggregation' || r === 'access'

  // Collect all VLANs defined anywhere
  const allDefinedVlans = new Set()
  for (const node of Object.values(nodeMap)) {
    for (const v of node._vlanSet) allDefinedVlans.add(v)
  }

  for (const [key, node] of Object.entries(nodeMap)) {
    const label = node.label || key

    // Rule 4: Switch-to-switch links should not be access mode
    if (isSwitch(node.role)) {
      for (const link of links) {
        if ((link.from === key || link.to === key) && link.mode === 'access') {
          const peerKey = link.from === key ? link.to : link.from
          const peer = nodeMap[peerKey]
          if (peer && isSwitch(peer.role)) {
            warnings.push({
              severity: 'error',
              device: key,
              deviceLabel: label,
              message: `交换机 "${label}" 与 "${peer.label || peerKey}" 之间使用了 Access 模式，交换机间应为 Trunk 模式`,
              fix: '右键链路 → 配置 VLAN → 选择 Trunk 模式',
            })
          }
        }
      }
    }

    // Rule 5: STP root bridge — core switch should have STP enabled
    if (node.role === 'core' && node.category === 'switch') {
      // This is informational — STP is always generated
    }

    // Rule 6: Management — all switches need a management IP (VLAN-based)
    if (isSwitch(node.role) && node._vlanSet.size === 0) {
      warnings.push({
        severity: 'warning',
        device: key,
        deviceLabel: label,
        message: `交换机 "${label}" 未配置任何 VLAN，缺少管理 VLAN 和业务 VLAN`,
        fix: '为交换机端口配置至少一个 VLAN（建议 VLAN 99 作为管理 VLAN）',
      })
    }
  }

  // Rule 7: Isolated devices (only 1 connection)
  for (const [key, node] of Object.entries(nodeMap)) {
    if (node._linkCount <= 1 && node.category !== 'cloud') {
      warnings.push({
        severity: 'info',
        device: key,
        deviceLabel: node.label || key,
        message: `设备 "${node.label || key}" 仅有 ${node._linkCount} 个连接，可能配置不完整`,
        fix: '确认该设备是否需要更多连线',
      })
    }
  }

  // Rule 2: Trunk VLAN range — downstream access VLAN should exist on upstream trunk
  for (const [key, node] of Object.entries(nodeMap)) {
    if (!isSwitch(node.role)) continue
    for (const link of links) {
      if (link.from !== key && link.to !== key) continue
      if (link.mode !== 'trunk') continue
      const peerKey = link.from === key ? link.to : link.from
      const peer = nodeMap[peerKey]
      if (!peer) continue
      // If peer has access VLANs not in our allowed list, warn
      const allowedSet = new Set((link.allowedVlans || []).map(v => typeof v === 'string' ? parseInt(v, 10) : v))
      for (const v of peer._vlanSet) {
        if (!allowedSet.has(v) && !isSwitch(peer.role)) {
          warnings.push({
            severity: 'warning',
            device: key,
            deviceLabel: label,
            message: `Trunk 链路 "${node.label || key} ↔ ${peer.label || peerKey}" 的允许 VLAN 列表中缺少 VLAN ${v}`,
            fix: `右键链路 → 将 VLAN ${v} 添加到允许列表`,
          })
        }
      }
    }
  }

  return warnings
}
