/**
 * Auto-assign subnets per VLAN using 192.168.{vlan}.0/24 pattern.
 * Returns a plan map: { vlanId: { subnet, gateway, dhcpStart, dhcpEnd, prefix } }
 */
export function autoAssignSubnets(vlans, opts = {}) {
  const plan = {}
  const basePattern = opts.basePattern || '192.168.{vlan}.0'
  const prefix = opts.prefix || 24

  for (const v of vlans) {
    const vlanId = typeof v === 'number' ? v : parseInt(v, 10)
    if (isNaN(vlanId) || vlanId < 1 || vlanId > 4094) continue

    const subnet = basePattern.replace('{vlan}', String(vlanId))
    const octets = subnet.split('.')
    octets[3] = '1'
    const gateway = octets.join('.')
    octets[3] = '100'
    const dhcpStart = octets.join('.')
    octets[3] = '254'
    const dhcpEnd = octets.join('.')

    plan[vlanId] = {
      vlanId,
      subnet: `${subnet}/${prefix}`,
      gateway,
      dhcpStart,
      dhcpEnd,
      prefix,
    }
  }
  return plan
}

/**
 * Merge subnets into node data so kb_engine can use them.
 * Returns enriched nodes with .subnets map.
 */
export function applySubnetPlan(nodes, subnetPlan) {
  const enriched = {}
  for (const [key, node] of Object.entries(nodes)) {
    enriched[key] = { ...node, subnetPlan }
  }
  return enriched
}

/**
 * Compute a DNS server hint from gateway (same as gateway by default).
 */
export function dnsServer(gateway) {
  return gateway
}
