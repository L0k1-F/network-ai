export function getLinkProperties(fromNode, toNode) {
  const fromRole = fromNode.role || 'endpoint'
  const toRole = toNode.role || 'endpoint'

  const isSwitch = (r) => r === 'core' || r === 'aggregation' || r === 'access'
  const isHighLevel = (r) => r === 'core' || r === 'aggregation'

  // Eth-Trunk: high-level switch ↔ high-level switch
  if (isHighLevel(fromRole) && isHighLevel(toRole)) {
    return { label: 'Eth-Trunk', color: '#B71C1C', strokeWidth: 4, bonded: true, bandwidth: '40GE' }
  }
  if ((fromRole === 'core' && toRole === 'access') || (fromRole === 'access' && toRole === 'core')) {
    return { label: 'Eth-Trunk', color: '#B71C1C', strokeWidth: 4, bonded: true, bandwidth: '40GE' }
  }

  // Regular Trunk: aggregation↔access or access↔access
  if (isSwitch(fromRole) && isSwitch(toRole)) {
    return { label: 'Trunk', color: '#D32F2F', strokeWidth: 2, bonded: false, bandwidth: '10GE' }
  }

  // Access: switch → endpoint
  if (isSwitch(fromRole) && toRole === 'endpoint') {
    return { label: 'Access', color: '#1565C0', strokeWidth: 1.5, bonded: false, bandwidth: '1GE' }
  }
  if (fromRole === 'endpoint' && isSwitch(toRole)) {
    return { label: 'Access', color: '#1565C0', strokeWidth: 1.5, bonded: false, bandwidth: '1GE' }
  }

  // Routed: anything involving router
  if (fromRole === 'router' || toRole === 'router') {
    return { label: 'Routed', color: '#2E7D32', strokeWidth: 2, bonded: false, bandwidth: '10GE' }
  }

  // Security zone: firewall/IPS related
  if (fromRole === 'security' || toRole === 'security') {
    return { label: 'Sec-Zone', color: '#E65100', strokeWidth: 2, bonded: false, bandwidth: '10GE' }
  }

  // Wireless
  if (fromRole === 'access-point' || toRole === 'access-point' ||
      fromRole === 'controller' || toRole === 'controller') {
    return { label: 'Wireless', color: '#6A1B9A', strokeWidth: 1.5, bonded: false, bandwidth: '1GE' }
  }

  return { label: 'Link', color: '#78909C', strokeWidth: 1.5, bonded: false, bandwidth: '1GE' }
}
