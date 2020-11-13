class KlineChart {
  constructor(targetId, options = {}) {
    const {
      width,
      height,
      margin,
      yAxisWidth,
      displayAmount,
    } = options

    this.target = document.getElementById(targetId) || null
    this.width = width || this.target.getBoundingClientRect().width
    this.height = height || 600
    this.margin = { top: 30, left: 30, bottom: 30, right: 30, ...margin }
    this.yAxisWidth = yAxisWidth || 60
    this.displayAmount = displayAmount || 100

    this.canvas = document.createElement('canvas')
    this.canvas.setAttribute('width', this.width)
    this.canvas.setAttribute('height', this.height)
    this.context = this.canvas.getContext('2d')
    
    if (this.target) {
      this.target.append(this.canvas)
    }

    this.rawData = []
    this.draw()
  }
  
  init(data) {
    this.rawData = data
    this.draw()
  }

  update(data) {
    if (this.rawData.length === 0) {
      throw Error('Please initialize data first.')
    }
    if (data[0] === this.rawData[this.rawData.length - 1][0]) {
      this.rawData = this.rawData.map(item => {
        return item[0] === data[0] ? data : item
      })
    } else {
      this.rawData = [...this.rawData, data]
    }
    window.requestAnimationFrame(this.draw.bind(this))
  }

  drawBefore() {
    this.data = this.rawData.slice(this.rawData.length - this.displayAmount)
    this.yMax = Math.max(...this.data.map(item => item.slice(1)).flat(), -Infinity)
    this.yMin = Math.min(...this.data.map(item => item.slice(1)).flat(), Infinity)
    this.xMax = Math.max(...this.data.map(item => item.slice(0, 1)).flat(), -Infinity)
    this.xMin = Math.min(...this.data.map(item => item.slice(0, 1)).flat(), Infinity)
  }

  draw() {
    this.drawBefore()
    // background
    this.context.fillStyle = '#14151A'
    this.context.fillRect(0, 0, this.width, this.height)

    // yaxis
    this.context.strokeStyle = '#26292F'
    this.context.lineWidth = 2
    this.context.beginPath()
    this.context.moveTo(this.width - this.margin.right - this.yAxisWidth, 0)
    this.context.lineTo(this.width - this.margin.right - this.yAxisWidth, this.height)
    this.context.stroke()

    // yTicks
    this.yTicks()

    // kline
    this.data.map(item => [
      this.getPosX(item[0]),
      this.getPosY(item[1]),
      this.getPosY(item[2]),
      this.getPosY(item[3]),
      this.getPosY(item[4]),
    ]).forEach(item => {
      this.kline(...item)
    })
  }

  yTicks() {
    this.context.fillStyle = '#505760'
    this.context.font = '14px sans-serif'
    this.context.textBaseline = 'middle'
    const tickAmount = 10
    const tickWidth = 8
    const tickX = this.width - this.yAxisWidth - this.margin.right
    const unit = (this.yMax - this.yMin) / (tickAmount - 1)
    const ticks = Array(tickAmount).fill(0)
      .map((_, i) => this.yMin + unit * i)
      .forEach(tick => {
        const tickY = this.getPosY(tick)
        this.context.fillText(tick.toFixed(2), tickX + tickWidth + 2, tickY)
        this.context.beginPath()
        this.context.moveTo(tickX, tickY)
        this.context.lineTo(tickX + tickWidth, tickY)
        this.context.stroke() 
      })
  }

  kline(time, open, high, low, close) {
    const axisLength = this.width - this.margin.left - this.margin.right - this.yAxisWidth
    const boxWidth = Math.max(axisLength / this.data.length, 4) - 2
    const lineWidth = 1
    const fillStyle = close < open ? '#5EBA89' : '#CE3D4E'
    this.context.fillStyle = fillStyle
    this.context.fillRect(time, Math.max(open, close), boxWidth, Math.abs(close - open)) // box
    this.context.fillRect(time + (boxWidth / 2) - (lineWidth / 2), high, lineWidth, Math.abs(high - low)) // line
  }

  /**
   * Utility
   */

  getPosX(data) {
    const axisLength = this.width - this.margin.left - this.margin.right - this.yAxisWidth - 20 // offset 20 px
    const xPos = (data - this.xMin) / (this.xMax - this.xMin) * axisLength
    return xPos + this.margin.left
  }

  getPosY(data) {
    const axisLength = this.height - this.margin.top - this.margin.bottom
    const yPos = (data - this.yMin) / (this.yMax - this.yMin) * axisLength
    return axisLength - yPos + this.margin.top
  }
}

(async function () {
  const seriesData = await fetchSeriesData()
  const chart = new KlineChart('kline')
  chart.init(seriesData)
  console.log('seriesData: ', seriesData)
  subcribe(data => { // data: [time, open, high, low, close]
    chart.update(data)
    console.log('subcribe: ', data)
  })

  // [time, open, high, low, close][]
  function fetchSeriesData() {
    return new Promise((resolve, reject) => {
      fetch('https://www.binance.com/api/v1/klines?symbol=BTCUSDT&interval=1m')
        .then(async res => {
          const data = await res.json()
          const result = data.map(([time, open, high, low, close]) => [time, open, high, low, close])
          resolve(result)
        })
        .catch(e => reject(e))
    })
  }
  function subcribe(success) {
    try {
      const socket = new WebSocket('wss://stream.binance.com/stream?streams=btcusdt@kline_1m')
      socket.onmessage = e => {
        const res = JSON.parse(e.data)
        const { t, o, h, l, c } = res.data.k
        success([t, o, h, l, c]);
      }
    } catch(e) {
      console.error(e.message)
    }
  }
})()
