import go from 'gojs'

export function createGridPattern() {
  const $ = go.GraphObject.make
  return $(go.Panel, 'Grid',
    { gridCellSize: new go.Size(20, 20) },
    $(go.Shape, 'Circle', {
      width: 2, height: 2,
      fill: '#B0BEC5',
      alignment: go.Spot.Center,
    })
  )
}
