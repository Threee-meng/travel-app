import { useState, useEffect, useRef } from 'react'
import './TripEdit.css'

const AMAP_KEY = 'e2c347ab0fa80da1220c9650bd4492e6'

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function TripEdit({ trip, onSave, onClose }) {
  const [tripName, setTripName] = useState('')
  const [activeSection, setActiveSection] = useState('overview')
  const [showAddModal, setShowAddModal] = useState(false)
  const [addType, setAddType] = useState('spot') // spot, hotel, transport
  const [favorites, setFavorites] = useState(trip.favorites || [])
  const [days, setDays] = useState(trip.days || [])
  const [searchKeyword, setSearchKeyword] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [aiGenerating, setAiGenerating] = useState(false)
  const [budget, setBudget] = useState(trip.budget || '')
  const [notes, setNotes] = useState(trip.notes || '')
  const [tags, setTags] = useState(trip.tags || [])
  const [tagInput, setTagInput] = useState('')
  const [activeRouteDayIndex, setActiveRouteDayIndex] = useState(null)
  const [addTargetDayIndex, setAddTargetDayIndex] = useState(null)
  const [recommendSnapshots, setRecommendSnapshots] = useState({})
  const mapRef = useRef(null)
  const mapInstance = useRef(null)
  const routeLayerRef = useRef([])
  const DEFAULT_DAY_START_TIME = '09:00'
  const DEFAULT_TRAVEL_MINUTES = 30
  const DEFAULT_STAY_MINUTES = {
    hotel: 0,
    transport: 30,
    spot: 120
  }

  const parseTimeToMinutes = (time) => {
    if (!time || !/^\d{2}:\d{2}$/.test(time)) return null
    const [hour, minute] = time.split(':').map(Number)
    if (Number.isNaN(hour) || Number.isNaN(minute)) return null
    return hour * 60 + minute
  }

  const formatMinutesToTime = (totalMinutes) => {
    const normalized = Math.max(0, totalMinutes)
    const hour = Math.floor(normalized / 60) % 24
    const minute = normalized % 60
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
  }

  const clampDuration = (value, fallback) => {
    const parsed = Number(value)
    if (!Number.isFinite(parsed) || parsed < 0) return fallback
    return Math.round(parsed)
  }

  const getDefaultStayMinutes = (type) => {
    return DEFAULT_STAY_MINUTES[type] ?? 90
  }

  const normalizeItemSchedule = (item, fallbackStartTime = DEFAULT_DAY_START_TIME) => ({
    ...item,
    startTime: item.startTime || item.time || fallbackStartTime,
    travelDuration: clampDuration(item.travelDuration, item.type === 'hotel' ? 0 : 0),
    stayDuration: clampDuration(item.stayDuration, getDefaultStayMinutes(item.type))
  })

  const recalculateDaySchedule = (day, options = {}) => {
    if (!day) return day

    const baseStartMinutes = parseTimeToMinutes(day.travelTime || DEFAULT_DAY_START_TIME)
      ?? parseTimeToMinutes(DEFAULT_DAY_START_TIME)
      ?? 540
    const preserveFirstItemStart = options.preserveFirstItemStart ?? false
    const items = (day.items || []).map((item) => normalizeItemSchedule(item, day.travelTime || DEFAULT_DAY_START_TIME))

    let currentStartMinutes = baseStartMinutes
    if (preserveFirstItemStart && items[0]?.startTime) {
      const firstItemStart = parseTimeToMinutes(items[0].startTime)
      currentStartMinutes = firstItemStart != null
        ? Math.max(0, firstItemStart - items[0].travelDuration)
        : baseStartMinutes
    }

    const nextItems = items.map((item) => {
      currentStartMinutes += item.travelDuration

      const startTime = formatMinutesToTime(currentStartMinutes)
      const normalizedItem = {
        ...item,
        startTime,
        time: startTime
      }

      currentStartMinutes += normalizedItem.stayDuration
      return normalizedItem
    })

    return {
      ...day,
      travelTime: day.travelTime || DEFAULT_DAY_START_TIME,
      items: nextItems
    }
  }

  const updateDayWithRecalculation = (dayIndex, updater, options = {}) => {
    setDays((prev) => prev.map((day, index) => {
      if (index !== dayIndex) return day
      const updatedDay = typeof updater === 'function' ? updater(day) : updater
      return recalculateDaySchedule(updatedDay, options)
    }))
  }

  // 初始化天数
  useEffect(() => {
    if (trip.startDate && trip.endDate) {
      const start = new Date(trip.startDate)
      const end = new Date(trip.endDate)
      const dayCount = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1

      const initDays = []
      for (let i = 0; i < dayCount; i++) {
        const date = new Date(start)
        date.setDate(date.getDate() + i)
        const dateStr = date.toISOString().split('T')[0]

        if (days[i]) {
          initDays.push(recalculateDaySchedule({ ...days[i], date: dateStr }))
        } else {
          initDays.push(recalculateDaySchedule({
            date: dateStr,
            items: [],
            travelTime: DEFAULT_DAY_START_TIME
          }))
        }
      }
      setDays(initDays)
    }
  }, [trip.startDate, trip.endDate])

  // 拖动排序功能
  const [draggingItem, setDraggingItem] = useState(null)
  const [draggingDay, setDraggingDay] = useState(null)

  const handleDragStart = (e, dayIndex, itemIndex) => {
    setDraggingItem(itemIndex)
    setDraggingDay(dayIndex)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e, dayIndex, itemIndex) => {
    e.preventDefault()
    if (draggingDay === null || draggingItem === null) return
    if (draggingDay === dayIndex) {
      // 在同一天内拖动
      const newDays = [...days]
      const draggedItem = newDays[draggingDay].items[draggingItem]
      newDays[draggingDay].items.splice(draggingItem, 1)
      newDays[draggingDay].items.splice(itemIndex, 0, draggedItem)
      // 更新顺序
      newDays[draggingDay].items.forEach((item, i) => {
        item.order = i + 1
      })
      newDays[draggingDay] = recalculateDaySchedule(newDays[draggingDay], { preserveFirstItemStart: true })
      setDays(newDays)
    } else {
      // 在不同天之间拖动
      const newDays = [...days]
      const draggedItem = newDays[draggingDay].items[draggingItem]
      newDays[draggingDay].items.splice(draggingItem, 1)
      newDays[dayIndex].items.splice(itemIndex, 0, draggedItem)
      // 更新顺序
      newDays[draggingDay].items.forEach((item, i) => {
        item.order = i + 1
      })
      newDays[dayIndex].items.forEach((item, i) => {
        item.order = i + 1
      })
      newDays[draggingDay] = recalculateDaySchedule(newDays[draggingDay], { preserveFirstItemStart: true })
      newDays[dayIndex] = recalculateDaySchedule(newDays[dayIndex], { preserveFirstItemStart: true })
      setDays(newDays)
    }
    setDraggingItem(null)
    setDraggingDay(null)
  }

  // 自动命名
  useEffect(() => {
    if (!tripName && days.length > 0) {
      setTripName(`${days.length}日游`)
    }
  }, [days.length])

  // 初始化地图
  useEffect(() => {
    if (!window.AMap || !mapRef.current) return

    const initMap = () => {
      if (mapInstance.current) {
        mapInstance.current.destroy()
      }

      // 根据城市设置中心点
      let center = [104.1954, 35.8617]
      let zoom = 5

      if (trip.cities && trip.cities.length > 0) {
        const city = trip.cities[0]
        // 简单根据城市名设置中心
        const cityCoords = {
          '北京': [116.397464, 39.907169],
          '上海': [121.473701, 31.230416],
          '广州': [113.264385, 23.129163],
          '深圳': [114.057868, 22.543099],
          '杭州': [120.155070, 30.274084],
          '成都': [104.065735, 30.659228],
          '重庆': [106.551556, 29.563010],
          '西安': [108.940175, 34.341568],
          '武汉': [114.305539, 30.593354],
          '南京': [118.796624, 32.059344],
          '厦门': [118.089425, 24.479834],
          '青岛': [120.382640, 36.067082],
          '天津': [117.200983, 39.084158],
          '苏州': [120.585315, 31.298886],
          '长沙': [112.938814, 28.228209],
          '郑州': [113.625354, 34.746599],
          '沈阳': [123.431521, 41.805699],
          '大连': [121.614696, 38.914003],
          '昆明': [102.834912, 24.874319],
          '丽江': [100.227914, 26.872147],
          '桂林': [110.290137, 25.273625],
          '三亚': [109.511665, 18.252847],
          '海口': [110.199405, 20.044155],
          '拉萨': [91.140856, 29.650178],
          '香港': [114.177736, 22.303330],
          '澳门': [113.543028, 22.186781],
          '内蒙古': [111.765230, 40.817498],
          '广西': [108.327537, 22.817854],
          '西藏': [91.117094, 29.647535],
          '宁夏': [106.259117, 38.472162],
          '新疆': [87.627704, 43.793581],
          '南昌': [115.858090, 28.682892],
          '赣州': [114.935545, 25.845295],
          '九江': [116.001509, 29.705090],
          '上饶': [117.943380, 28.455633],
          '景德镇': [117.184696, 29.274578],
          '井冈山': [114.491048, 26.529468],
          '黄山': [118.337648, 29.718708],
          '庐山': [115.962762, 29.613206],
          '泰山': [117.054327, 36.194851],
          '洛阳': [112.454050, 34.619445],
          '开封': [114.307503, 34.797158],
          '平遥': [112.351141, 37.195789],
          '大同': [113.295613, 40.075495],
          '秦皇岛': [119.588581, 39.925385],
          '大理': [100.267355, 25.593216],
          '香格里拉': [99.702447, 27.818553],
          '西双版纳': [100.797719, 22.009533],
          '张家界': [110.479191, 29.117096],
          '凤凰': [109.599074, 27.947416],
          '乌镇': [120.482738, 30.635590],
          '西塘': [120.891472, 30.956144],
          '千岛湖': [119.047142, 29.601442],
          '婺源': [117.861342, 29.373800],
          '腾冲': [98.496184, 25.017751],
          '瑞丽': [97.858692, 24.021408],
          '泸沽湖': [100.754933, 27.677153],
          '稻城': [100.300743, 28.998716],
          '亚丁': [100.300743, 28.998716],
          '色达': [100.677339, 32.275212],
          '敦煌': [94.662439, 40.143126],
          '嘉峪关': [98.289439, 39.773013],
          '青海湖': [99.938580, 36.959473],
          '威海': [122.120429, 37.513074],
          '烟台': [121.447852, 37.463822],
          '蓬莱': [120.758080, 37.810575],
          '台山': [112.793263, 22.251513],
          '惠州': [114.416859, 23.111547],
          '汕头': [116.682654, 23.354053],
          '湛江': [110.365067, 21.274423],
          '珠海': [113.562796, 22.250923],
          '中山': [113.382370, 22.517856],
          '东莞': [113.751790, 23.020535],
          '佛山': [113.122717, 23.028707],
          '保定': [115.464582, 38.874043],
          '唐山': [118.180193, 39.624831],
          '张家口': [114.886252, 40.768244],
          '宁波': [121.544112, 29.868323],
          '温州': [120.699756, 28.000612],
          '嘉兴': [120.755072, 30.750345],
          '绍兴': [120.582112, 30.030357],
          '金华': [119.652174, 29.712479],
          '南通': [120.893977, 31.980797],
          '扬州': [119.412966, 32.393215],
          '徐州': [117.284316, 34.205768],
          '昆山': [120.980474, 31.386115],
          '周庄': [120.689855, 31.115057],
          '同里': [120.641795, 31.170128],
          '无锡': [120.305456, 31.570382],
          '常州': [119.974061, 31.811196],
          '舟山': [122.106848, 30.017701],
          '九华山': [117.479689, 30.466850],
          '宏村': [117.983158, 29.914996],
          '西递': [117.997940, 29.900669],
          '芜湖': [118.433713, 31.352859],
          '泉州': [118.675816, 24.873795],
          '武夷山': [117.941275, 27.712975],
          '漳州': [117.647305, 24.517064],
          '宜昌': [111.286951, 30.691970],
          '襄阳': [112.122844, 32.009343],
          '武当山': [111.943736, 32.437889],
          '岳阳': [113.128718, 29.362869],
          '衡山': [112.607684, 27.308116],
          '华山': [110.089770, 34.583922],
          '兵马俑': [109.278044, 34.384772],
          '延安': [109.489807, 36.585212],
          '乾陵': [108.220677, 35.286652],
          '兰州': [103.834303, 36.061380],
          '张掖': [100.449052, 38.925802],
          '天水': [105.724607, 34.580581],
          '西宁': [101.778280, 36.617291],
          '格尔木': [94.901490, 36.419857],
          '茶卡盐湖': [99.080558, 36.786671],
          '银川': [106.258613, 38.486758],
          '石嘴山': [106.383075, 39.019027],
          '吴忠': [106.198242, 37.997649],
          '贵阳': [106.630360, 26.647003],
          '黄果树': [105.665836, 26.093949],
          '遵义': [106.927438, 27.725776],
          '镇远': [108.444418, 27.050150],
          '西江千户苗寨': [108.186470, 26.487785],
          '南宁': [108.366379, 22.817317],
          '漓江': [110.146443, 25.479582],
          '阳朔': [110.496865, 24.955301],
          '梧州': [111.284775, 23.477253],
          '北海': [109.119254, 21.481343],
          '太原': [112.534947, 37.857214],
          '朔州': [112.432991, 39.331588],
          '运城': [111.006337, 35.026800],
          '呼和浩特': [111.755509, 40.842530],
          '包头': [109.840405, 40.656174],
          '鄂尔多斯': [109.790327, 39.608444],
          '赤峰': [118.886930, 42.257993],
          '呼伦贝尔': [119.766052, 49.211761],
          '长春': [125.323544, 43.816240],
          '吉林': [126.549443, 43.837840],
          '延吉': [129.508673, 42.906757],
          '四平': [124.350642, 43.166420],
          '哈尔滨': [126.534967, 45.803775],
          '大庆': [125.021212, 46.579705],
          '齐齐哈尔': [123.957920, 47.354347],
          '牡丹江': [129.633022, 44.551226],
          '济南': [116.994170, 36.606386],
          '曲阜': [116.985302, 35.571639],
          '乌鲁木齐': [87.623077, 43.832769],
          '克拉玛依': [85.160729, 45.579816],
          '吐鲁番': [89.196535, 42.951326],
          '伊犁': [81.317441, 43.921486],
          '台北': [121.565426, 25.033963],
          '高雄': [120.301435, 22.627278],
          '台中': [120.645698, 24.151624],
          '垦丁': [120.796326, 22.004418],
          '花莲': [121.611514, 23.987745],
        }

        if (cityCoords[city]) {
          center = cityCoords[city]
          zoom = 10
        } else {
          // 尝试匹配省份
          const provinceCities = {
            '北京': [116.397464, 39.907169],
            '上海': [121.473701, 31.230416],
            '天津': [117.200983, 39.084158],
            '重庆': [106.551556, 29.563010],
          }
          if (provinceCities[city]) {
            center = provinceCities[city]
            zoom = 9
          }
        }
      }

      const map = new window.AMap.Map('trip-edit-map', {
        zoom,
        center,
        mapStyle: 'amap://styles/normal'
      })

      mapInstance.current = map

      // 点击地图添加收藏
      map.on('click', (e) => {
        const lng = e.lnglat.getLng()
        const lat = e.lnglat.getLat()

        // 逆地理编码获取地址
        fetch(`https://restapi.amap.com/v3/geocode/regeo?location=${lng},${lat}&key=${AMAP_KEY}`)
          .then(res => res.json())
          .then(data => {
            if (data.status === '1' && data.regeocode) {
              const name = data.regeocode.formatted_address || '未命名地点'
              const newFavorite = {
                id: Date.now().toString(),
                name: name,
                location: { lng, lat },
                type: 'spot',
                address: data.regeocode.formatted_address
              }
              setFavorites(prev => [...prev, newFavorite])
            }
          })
      })

      // 添加收藏标记
      updateMapMarkers(map, favorites)
    }

    if (window.AMap) {
      initMap()
    } else {
      const script = document.createElement('script')
      script.src = `https://webapi.amap.com/maps?v=1.4.15&key=${AMAP_KEY}`
      script.async = true
      script.onload = initMap
      document.head.appendChild(script)
    }

    return () => {
      if (mapInstance.current) {
        mapInstance.current.destroy()
        mapInstance.current = null
        routeLayerRef.current = []
      }
    }
  }, [])

  const clearDayRouteLayer = () => {
    if (mapInstance.current && routeLayerRef.current.length > 0) {
      mapInstance.current.remove(routeLayerRef.current)
    }

    routeLayerRef.current = []
    setActiveRouteDayIndex(null)
  }

  // 更新地图标记
  const updateMapMarkers = (map, favs) => {
    if (!map) return
    map.clearMap()
    routeLayerRef.current = []

    favs.forEach(fav => {
      if (fav.location) {
        const marker = new window.AMap.Marker({
          position: [fav.location.lng, fav.location.lat],
          title: fav.name
        })
        map.add(marker)
      }
    })
  }

  // 搜索地点
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchKeyword.trim()) {
        searchPlaces(searchKeyword)
      } else {
        setSearchResults([])
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchKeyword])

  const searchPlaces = async (keyword) => {
    setSearching(true)
    try {
      const response = await fetch(
        `https://restapi.amap.com/v3/place/text?keywords=${encodeURIComponent(keyword)}&city=全国&offset=20&page=1&key=${AMAP_KEY}`
      )
      const data = await response.json()
      if (data.status === '1' && data.pois) {
        setSearchResults(data.pois.slice(0, 10))
      }
    } catch (err) {
      console.error('搜索失败:', err)
    } finally {
      setSearching(false)
    }
  }

  // 添加到收藏
  const addToFavorites = (item) => {
    const newFavorite = {
      id: Date.now().toString(),
      name: item.name,
      location: item.location ? {
        lng: parseFloat(item.location.split(',')[0]),
        lat: parseFloat(item.location.split(',')[1])
      } : null,
      type: addType,
      address: item.address || ''
    }
    setFavorites(prev => [...prev, newFavorite])

    if (mapInstance.current && newFavorite.location) {
      const marker = new window.AMap.Marker({
        position: [newFavorite.location.lng, newFavorite.location.lat],
        title: newFavorite.name
      })
      mapInstance.current.add(marker)
    }

    return newFavorite
  }

  // 从收藏删除
  const removeFromFavorites = (id) => {
    setFavorites(prev => prev.filter(f => f.id !== id))
  }

  // AI生成路线
  const generateRoute = async () => {
    if (favorites.length === 0 || days.length === 0) return

    setAiGenerating(true)

    // 模拟AI生成延迟
    await new Promise(resolve => setTimeout(resolve, 1500))

    // 先重置所有favorites的assigned状态
    const resetFavorites = favorites.map(f => ({ ...f, assigned: false }))

    // 按类型分组
    const spots = resetFavorites.filter(f => f.type === 'spot')
    const hotels = resetFavorites.filter(f => f.type === 'hotel')
    const transports = resetFavorites.filter(f => f.type === 'transport')

    // 简单的贪心算法：尽量把景点分配到不同天，每天安排3-4个景点
    const itemsPerDay = Math.max(3, Math.ceil(spots.length / days.length))
    let spotIndex = 0

    const newDays = days.map((day, dayIndex) => {
      const dayItems = []

      // 分配景点
      const daySpots = []
      for (let i = 0; i < itemsPerDay && spotIndex < spots.length; i++) {
        const spot = { ...spots[spotIndex], assigned: true }
        daySpots.push(spot)
        spots[spotIndex].assigned = true
        spotIndex++
      }

      // 给每天的景点编号排序
      daySpots.forEach((item, i) => {
        dayItems.push({
          ...item,
          order: dayItems.length + 1,
          startTime: `${String(9 + i * 2).padStart(2, '0')}:00`,
          time: `${String(9 + i * 2).padStart(2, '0')}:00`,
          travelDuration: i === 0 ? 0 : DEFAULT_TRAVEL_MINUTES,
          stayDuration: getDefaultStayMinutes(item.type)
        })
      })

      // 如果是第一天，添加住宿
      if (dayIndex === 0 && hotels.length > 0) {
        dayItems.unshift({
          ...hotels[0],
          order: 0,
          startTime: DEFAULT_DAY_START_TIME,
          time: DEFAULT_DAY_START_TIME,
          travelDuration: 0,
          stayDuration: 0,
          type: 'hotel'
        })
        hotels[0].assigned = true
      }

      // 如果不是最后一天，添加交通
      if (dayIndex < days.length - 1 && transports.length > dayIndex) {
        dayItems.push({
          ...transports[dayIndex],
          order: dayItems.length + 1,
          startTime: '',
          time: '',
          travelDuration: DEFAULT_TRAVEL_MINUTES,
          stayDuration: getDefaultStayMinutes('transport'),
          type: 'transport'
        })
        transports[dayIndex].assigned = true
      }

      return {
        ...day,
        travelTime: day.travelTime || DEFAULT_DAY_START_TIME,
        items: recalculateDaySchedule({
          ...day,
          travelTime: day.travelTime || DEFAULT_DAY_START_TIME,
          items: dayItems
        }).items
      }
    })

    setDays(newDays)
    setAiGenerating(false)
  }

  // 添加标签
  const addTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()])
      setTagInput('')
    }
  }

  // 删除标签
  const removeTag = (tag) => {
    setTags(tags.filter(t => t !== tag))
  }

  // 保存行程
  const handleSave = () => {
    onSave({
      ...trip,
      name: tripName,
      favorites,
      days,
      budget,
      notes,
      tags
    })
  }

  // 添加住宿/交通
  const handleAddItem = (item) => {
    const newFavorite = addToFavorites({ ...item, type: addType })

    if (addTargetDayIndex !== null && newFavorite) {
      updateDayWithRecalculation(addTargetDayIndex, (day) => ({
        ...day,
        items: [
          ...(day.items || []),
          {
            ...newFavorite,
            order: (day.items || []).length + 1,
            travelDuration: (day.items || []).length === 0 ? 0 : DEFAULT_TRAVEL_MINUTES,
            stayDuration: getDefaultStayMinutes(newFavorite.type),
            startTime: '',
            time: ''
          }
        ]
      }), { preserveFirstItemStart: true })
    }

    setShowAddModal(false)
    setAddTargetDayIndex(null)
    setSearchKeyword('')
    setSearchResults([])
  }

  const openAddModalForDay = (dayIndex) => {
    setAddType('spot')
    setAddTargetDayIndex(dayIndex)
    setSearchKeyword('')
    setSearchResults([])
    setShowAddModal(true)
  }

  const closeAddModal = () => {
    setShowAddModal(false)
    setAddTargetDayIndex(null)
    setSearchKeyword('')
    setSearchResults([])
  }

  // 从某天删除项目
  const removeFromDay = (dayIndex, itemId) => {
    updateDayWithRecalculation(dayIndex, (day) => ({
      ...day,
      items: day.items.filter(item => item.id !== itemId)
    }), { preserveFirstItemStart: true })
  }

  // 计算出行方式和时间
  const createXiaohongshuSearchUrl = (item) => {
    const keyword = [item.name, item.address].filter(Boolean).join(' ')
    return `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(keyword || '旅行攻略')}`
  }

  const getHomeworkLinks = (item) => {
    if (Array.isArray(item.homeworkLinks)) {
      return item.homeworkLinks
    }

    return item.homeworkLink ? [item.homeworkLink] : ['']
  }

  const updateHomeworkLinks = (dayIndex, itemIndex, links) => {
    updateDayWithRecalculation(dayIndex, (day) => {
      const items = [...day.items]
      const nextLinks = links.map((link) => link.trim())

      items[itemIndex] = {
        ...items[itemIndex],
        homeworkLinks: nextLinks,
        homeworkLink: nextLinks.find(Boolean) || ''
      }

      return {
        ...day,
        items
      }
    }, { preserveFirstItemStart: true })
  }

  const updateHomeworkLinkAt = (dayIndex, itemIndex, linkIndex, value) => {
    const links = [...getHomeworkLinks(days[dayIndex].items[itemIndex])]
    links[linkIndex] = value
    updateHomeworkLinks(dayIndex, itemIndex, links)
  }

  const addHomeworkLink = (dayIndex, itemIndex) => {
    const links = [...getHomeworkLinks(days[dayIndex].items[itemIndex])]
    updateHomeworkLinks(dayIndex, itemIndex, [...links, ''])
  }

  const removeHomeworkLink = (dayIndex, itemIndex, linkIndex) => {
    const links = [...getHomeworkLinks(days[dayIndex].items[itemIndex])]
    const nextLinks = links.filter((_, index) => index !== linkIndex)
    updateHomeworkLinks(dayIndex, itemIndex, nextLinks.length > 0 ? nextLinks : [''])
  }

  const calculateTransportation = (from, to) => {
    if (!from.location || !to.location) return { options: [] }

    const distance = Math.sqrt(
      Math.pow(from.location.lng - to.location.lng, 2) + 
      Math.pow(from.location.lat - to.location.lat, 2)
    ) * 111 // 大致距离（公里）

    const options = []

    // 步行（无论距离多远都添加）
    options.push({
      type: '步行',
      time: Math.round(distance * 15), // 步行速度约4km/h
      cost: 0
    })

    // 地铁
    options.push({
      type: '地铁',
      time: Math.round(distance * 2 + 5), // 平均速度约30km/h，加上换乘时间
      cost: 5
    })

    // 打车
    options.push({
      type: '打车',
      time: Math.round(distance * 1.5 + 3), // 平均速度约40km/h，加上等待时间
      cost: Math.round(distance * 2 + 10)
    })

    return { options }
  }

  // 处理时间修改
  const getRouteTransportation = (day, fromIndex, toIndex) => {
    const selectedTransport = day.transportations?.[`${fromIndex}-${toIndex}`]
    if (selectedTransport) return selectedTransport

    const fromItem = day.items[fromIndex]
    const toItem = day.items[toIndex]
    const { options } = calculateTransportation(fromItem, toItem)
    return options[0] || {
      type: '步行',
      time: toItem?.travelDuration || DEFAULT_TRAVEL_MINUTES,
      cost: 0
    }
  }

  const generateDayRoute = (dayIndex) => {
    const day = days[dayIndex]
    if (!mapInstance.current || !window.AMap || !day) return

    const routeItems = (day.items || [])
      .map((item, originalIndex) => ({ ...item, originalIndex }))
      .filter((item) => item.location && Number.isFinite(Number(item.location.lng)) && Number.isFinite(Number(item.location.lat)))

    if (routeItems.length === 0) {
      window.alert('这一天还没有可显示在地图上的地点')
      return
    }

    clearDayRouteLayer()
    mapInstance.current.clearMap()
    routeLayerRef.current = []

    routeItems.forEach((item, index) => {
      const marker = new window.AMap.Marker({
        position: [item.location.lng, item.location.lat],
        title: item.name,
        content: `
          <div class="day-route-star-marker" title="${escapeHtml(item.name)}">
            <span class="day-route-star">⭐</span>
            <span class="day-route-order">${index + 1}</span>
          </div>
        `,
        offset: new window.AMap.Pixel(-18, -36)
      })

      const infoWindow = new window.AMap.InfoWindow({
        content: `
          <div class="day-route-info">
            <strong>${index + 1}. ${escapeHtml(item.name)}</strong>
            <span>${escapeHtml(item.address || item.startTime || '')}</span>
          </div>
        `,
        offset: new window.AMap.Pixel(0, -34)
      })

      marker.on('click', () => {
        infoWindow.open(mapInstance.current, marker.getPosition())
      })

      mapInstance.current.add(marker)
      routeLayerRef.current.push(marker)
    })

    for (let index = 1; index < routeItems.length; index++) {
      const fromItem = routeItems[index - 1]
      const toItem = routeItems[index]
      const fromPosition = [fromItem.location.lng, fromItem.location.lat]
      const toPosition = [toItem.location.lng, toItem.location.lat]
      const transportation = getRouteTransportation(day, fromItem.originalIndex, toItem.originalIndex)

      const polyline = new window.AMap.Polyline({
        path: [fromPosition, toPosition],
        strokeColor: '#ff6b35',
        strokeWeight: 5,
        strokeOpacity: 0.9,
        lineJoin: 'round',
        showDir: true
      })

      const midPosition = [
        (Number(fromItem.location.lng) + Number(toItem.location.lng)) / 2,
        (Number(fromItem.location.lat) + Number(toItem.location.lat)) / 2
      ]

      const labelMarker = new window.AMap.Marker({
        position: midPosition,
        content: `
          <div class="day-route-transport-label">
            ${escapeHtml(transportation.type)}${Math.max(1, Math.round(transportation.time || DEFAULT_TRAVEL_MINUTES))}min
          </div>
        `,
        offset: new window.AMap.Pixel(-42, -16),
        zIndex: 120
      })

      mapInstance.current.add(polyline)
      mapInstance.current.add(labelMarker)
      routeLayerRef.current.push(polyline, labelMarker)
    }

    mapInstance.current.setFitView(routeLayerRef.current)
    setActiveRouteDayIndex(dayIndex)
  }

  const handleTimeChange = (dayIndex, itemIndex, field, rawValue) => {
    updateDayWithRecalculation(dayIndex, (day) => {
      const items = [...day.items]
      const nextItem = normalizeItemSchedule(items[itemIndex], day.travelTime || DEFAULT_DAY_START_TIME)

      if (field === 'startTime') {
        nextItem.startTime = rawValue
        nextItem.time = rawValue
        items[itemIndex] = nextItem

        if (itemIndex === 0) {
          return {
            ...day,
            travelTime: rawValue || day.travelTime || DEFAULT_DAY_START_TIME,
            items
          }
        }

        const previousItem = normalizeItemSchedule(items[itemIndex - 1], day.travelTime || DEFAULT_DAY_START_TIME)
        const previousStart = parseTimeToMinutes(previousItem.startTime || previousItem.time)
        const currentStart = parseTimeToMinutes(rawValue)
        if (previousStart != null && currentStart != null) {
          nextItem.travelDuration = Math.max(0, currentStart - previousStart - previousItem.stayDuration)
          items[itemIndex] = nextItem
        }

        return {
          ...day,
          items
        }
      }

      nextItem[field] = clampDuration(rawValue, nextItem[field])
      items[itemIndex] = nextItem

      return {
        ...day,
        items
      }
    }, { preserveFirstItemStart: true })
  }

  // 计算两点之间的距离
  const calculateDistance = (from, to) => {
    if (!from.location || !to.location) return Infinity
    return Math.sqrt(
      Math.pow(from.location.lng - to.location.lng, 2) + 
      Math.pow(from.location.lat - to.location.lat, 2)
    )
  }

  // AI推荐最合理的出行顺序和时间安排
  const recommendOrder = (dayIndex) => {
    const day = days[dayIndex]
    if (!day || day.items.length < 2) return

    setRecommendSnapshots((prev) => ({
      ...prev,
      [dayIndex]: JSON.parse(JSON.stringify(day))
    }))

    const items = day.items
    const startIndex = items.findIndex(item => item.type === 'hotel' && item.order === 1)
    let currentIndex = startIndex === -1 ? 0 : startIndex

    const unvisited = [...items]
    const visited = [unvisited.splice(currentIndex, 1)[0]]

    while (unvisited.length > 0) {
      let nearestDistance = Infinity
      let nearestIndex = 0

      for (let i = 0; i < unvisited.length; i++) {
        const distance = calculateDistance(visited[visited.length - 1], unvisited[i])
        if (distance < nearestDistance) {
          nearestDistance = distance
          nearestIndex = i
        }
      }

      visited.push(unvisited.splice(nearestIndex, 1)[0])
    }

    // AI推荐时间安排
    const itemsWithTime = recalculateDaySchedule({
      ...day,
      travelTime: day.travelTime || DEFAULT_DAY_START_TIME,
      items: visited.map((item, index) => {
        return {
          ...item,
          travelDuration: index === 0 ? 0 : (
            (() => {
              const { options } = calculateTransportation(visited[index - 1], item)
              const fastestTransport = options.length > 0
                ? options.reduce((prev, current) => (prev.time < current.time ? prev : current))
                : null
              return fastestTransport?.time ?? DEFAULT_TRAVEL_MINUTES
            })()
          ),
          stayDuration: clampDuration(item.stayDuration, getDefaultStayMinutes(item.type))
        }
      })
    }).items

    const newItems = itemsWithTime.map((item, index) => ({
      ...item,
      order: index + 1
    }))

    const newDays = [...days]
    newDays[dayIndex] = recalculateDaySchedule({
      ...day,
      items: newItems
    })

    setDays(newDays)
  }

  const undoRecommendOrder = (dayIndex) => {
    const snapshot = recommendSnapshots[dayIndex]
    if (!snapshot) return

    setDays((prev) => prev.map((day, index) => (index === dayIndex ? snapshot : day)))
    setRecommendSnapshots((prev) => {
      const next = { ...prev }
      delete next[dayIndex]
      return next
    })

    if (activeRouteDayIndex === dayIndex) {
      clearDayRouteLayer()
      if (mapInstance.current) {
        updateMapMarkers(mapInstance.current, favorites)
      }
    }
  }

  // 处理出行方式选择
  const handleTransportationSelect = (dayIndex, fromIndex, toIndex, transportation) => {
    updateDayWithRecalculation(dayIndex, (day) => {
      const nextDay = {
        ...day,
        transportations: {
          ...(day.transportations || {}),
          [`${fromIndex}-${toIndex}`]: transportation
        },
        items: [...day.items]
      }

      const targetItem = normalizeItemSchedule(nextDay.items[toIndex], day.travelTime || DEFAULT_DAY_START_TIME)
      targetItem.travelDuration = clampDuration(transportation?.time, targetItem.travelDuration)
      nextDay.items[toIndex] = targetItem

      return nextDay
    }, { preserveFirstItemStart: true })
  }

  const hotelFavorites = favorites.filter(f => f.type === 'hotel')
  const getDayLabel = (dayNumber) => {
    const labels = ['第一天', '第二天', '第三天', '第四天', '第五天', '第六天', '第七天', '第八天', '第九天', '第十天']
    return labels[dayNumber - 1] || `第${dayNumber}天`
  }

  return (
    <div className="trip-edit-overlay">
      <div className="trip-edit-panel">
        {/* 头部 */}
        <div className="trip-edit-header">
          <input
            type="text"
            className="trip-name-input"
            value={tripName}
            onChange={e => setTripName(e.target.value)}
            placeholder="行程名称"
          />
          <button className="trip-edit-close" onClick={onClose}>×</button>
        </div>

        {/* 标签页 */}
        <div className="trip-edit-tabs">
          <button
            className={`tab ${activeSection === 'favorites' ? 'active' : ''}`}
            onClick={() => setActiveSection('favorites')}
          >
            我的收藏
          </button>
          <button
            className={`tab ${activeSection === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveSection('overview')}
          >
            总览
          </button>
          <button
            className={`tab ${activeSection === 'schedule' ? 'active' : ''}`}
            onClick={() => setActiveSection('schedule')}
          >
            {days.length > 0 ? '每日行程' : '每日行程'}
          </button>
        </div>

        {/* 内容区 */}
        <div className="trip-edit-content">
          {/* 我的收藏 */}
          {activeSection === 'favorites' && (
            <div className="section-favorites">
              {/* 临时小窝 - 添加住宿 */}
              <div className="temp-hotel-section">
                <div className="temp-hotel-header">
                  <span>🏨 临时小窝</span>
                  <button
                    className="add-hotel-btn"
                    onClick={() => {
                      setAddType('hotel')
                      setShowAddModal(true)
                    }}
                  >
                    添加住宿
                  </button>
                </div>
                <div className="temp-hotel-list">
                  {hotelFavorites.length === 0 ? (
                    <div className="temp-hotel-empty">添加住宿后会显示在这里</div>
                  ) : (
                    hotelFavorites.map(hotel => (
                      <div key={hotel.id} className="temp-hotel-item">
                        <div className="temp-hotel-info">
                          <div className="temp-hotel-name">{hotel.name}</div>
                          <div className="temp-hotel-address">{hotel.address || '暂无地址'}</div>
                        </div>
                        <button className="favorite-delete" onClick={() => removeFromFavorites(hotel.id)}>×</button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="favorites-list">
                {favorites.filter(f => f.type !== 'hotel').length === 0 ? (
                  <div className="empty-tip">点击地图或搜索添加地点</div>
                ) : (
                  favorites.filter(f => f.type !== 'hotel').map(fav => (
                    <div key={fav.id} className="favorite-item">
                      <div className="favorite-info">
                        <span className="favorite-name">{fav.name}</span>
                        <span className="favorite-type">
                          {fav.type === 'transport' ? '交通' : '景点'}
                        </span>
                      </div>
                      <button className="favorite-delete" onClick={() => removeFromFavorites(fav.id)}>×</button>
                    </div>
                  ))
                )}
              </div>
              <button className="ai-generate-btn" onClick={generateRoute} disabled={aiGenerating || favorites.filter(f => f.type === 'spot').length === 0}>
                {aiGenerating ? 'AI生成中...' : 'AI智能生成路线'}
              </button>
            </div>
          )}

          {/* 总览 */}
          {activeSection === 'overview' && (
            <div className="section-overview">
              <div className="overview-info">
                <div className="overview-dates">
                  {days.length > 0 && (
                    <span>{days[0].date} ~ {days[days.length - 1].date}</span>
                  )}
                </div>
                <div className="overview-cities">
                  目的地：{trip.cities?.join('、')}
                </div>
                <div className="overview-stats">
                  <span>景点：{favorites.filter(f => f.type === 'spot').length}</span>
                  <span>住宿：{favorites.filter(f => f.type === 'hotel').length}</span>
                  <span>交通：{favorites.filter(f => f.type === 'transport').length}</span>
                </div>
                
                {/* 预算 */}
                <div className="overview-budget">
                  <label>预算：</label>
                  <input
                    type="number"
                    className="budget-input"
                    value={budget}
                    onChange={e => setBudget(e.target.value)}
                    placeholder="输入预算金额"
                  />
                  <span className="budget-unit">元</span>
                </div>
                
                {/* 标签 */}
                <div className="overview-tags">
                  <label>标签：</label>
                  <div className="tags-container">
                    <div className="tags-list">
                      {tags.map((tag, index) => (
                        <span key={index} className="tag-item">
                          {tag}
                          <button className="tag-remove" onClick={() => removeTag(tag)}>×</button>
                        </span>
                      ))}
                    </div>
                    <div className="tag-input-container">
                      <input
                        type="text"
                        className="tag-input"
                        value={tagInput}
                        onChange={e => setTagInput(e.target.value)}
                        onKeyPress={e => e.key === 'Enter' && addTag()}
                        placeholder="添加标签"
                      />
                      <button className="tag-add" onClick={addTag}>添加</button>
                    </div>
                  </div>
                </div>
                
                {/* 备注 */}
                <div className="overview-notes">
                  <label>备注：</label>
                  <textarea
                    className="notes-input"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="添加行程备注..."
                    rows={4}
                  />
                </div>
              </div>
            </div>
          )}

          {/* 第几天 */}
          {activeSection === 'schedule' && (
            <div className="section-schedule">
              <div className="days-list">
                {days.map((day, dayIndex) => {
                  const dayNumber = dayIndex + 1
                  const dayLabel = getDayLabel(dayNumber)
                  return (
                    <div key={dayIndex} className="day-item">
                      <div className="day-header">
                        <span className="day-title">{dayLabel}</span>
                        <span className="day-date">{day.date}</span>
                        <button
                          className="day-add-place-btn"
                          onClick={() => openAddModalForDay(dayIndex)}
                        >
                          + 添加地点
                        </button>
                        <button
                          className={`day-route-btn ${activeRouteDayIndex === dayIndex ? 'active' : ''}`}
                          onClick={() => generateDayRoute(dayIndex)}
                          disabled={day.items.filter(item => item.location).length === 0}
                        >
                          {activeRouteDayIndex === dayIndex ? '重新生成路线' : '生成路线'}
                        </button>
                        <input
                          type="time"
                          className="day-time"
                          value={day.travelTime || DEFAULT_DAY_START_TIME}
                          onChange={e => {
                            updateDayWithRecalculation(dayIndex, (currentDay) => ({
                              ...currentDay,
                              travelTime: e.target.value || DEFAULT_DAY_START_TIME
                            }))
                          }}
                        />
                        <button 
                          className="ai-recommend-btn"
                          onClick={() => recommendOrder(dayIndex)}
                          disabled={day.items.length <= 2}
                        >
                          AI推荐顺序
                        </button>
                        {recommendSnapshots[dayIndex] && (
                          <button
                            className="undo-recommend-btn"
                            onClick={() => undoRecommendOrder(dayIndex)}
                          >
                            撤回推荐
                          </button>
                        )}
                      </div>
                      <div className="day-items">
                        {day.items.length === 0 ? (
                          <div className="day-empty">暂无安排</div>
                        ) : (
                          day.items.map((item, itemIndex) => (
                            <div key={item.id} className="day-item-block">
                              {itemIndex > 0 && (
                                <div className="transportation-section">
                                  <div className="transportation-header">
                                    <span>出行方式</span>
                                  </div>
                                  <div className="transportation-options">
                                    {(() => {
                                      const fromItem = day.items[itemIndex - 1]
                                      const toItem = item
                                      const { options } = calculateTransportation(fromItem, toItem)
                                      const selectedTransport = day.transportations?.[`${itemIndex - 1}-${itemIndex}`]
                                      return options.map((option, index) => (
                                        <div 
                                          key={index}
                                          className={`transportation-option ${selectedTransport?.type === option.type ? 'selected' : ''}`}
                                          onClick={() => handleTransportationSelect(dayIndex, itemIndex - 1, itemIndex, option)}
                                        >
                                          <span className="transportation-type">{option.type}</span>
                                          <span className="transportation-time">{option.time}分钟</span>
                                          {option.cost > 0 && <span className="transportation-cost">¥{option.cost}</span>}
                                        </div>
                                      ))
                                    })()}
                                  </div>
                                </div>
                              )}
                              <div 
                                className="day-item-card"
                                draggable
                                onDragStart={(e) => handleDragStart(e, dayIndex, itemIndex)}
                                onDragOver={(e) => handleDragOver(e, dayIndex, itemIndex)}
                                onDrop={(e) => handleDrop(e, dayIndex, itemIndex)}
                              >
                                <span className="item-order">{item.order}</span>
                                <span className="item-name">
                                  {item.type === 'hotel' ? '🏨 ' : item.type === 'transport' ? '🚗 ' : ''}
                                  {item.name}
                                </span>
                                <div className="item-schedule-grid">
                                  <label className="item-schedule-field">
                                    <span>出行</span>
                                    <input
                                      type="time"
                                      className="item-time-input"
                                      value={item.startTime || item.time || ''}
                                      onChange={(e) => handleTimeChange(dayIndex, itemIndex, 'startTime', e.target.value)}
                                    />
                                  </label>
                                  <label className="item-schedule-field">
                                    <span>游玩</span>
                                    <input
                                      type="number"
                                      min="0"
                                      step="10"
                                      className="item-duration-input"
                                      value={item.stayDuration ?? getDefaultStayMinutes(item.type)}
                                      onChange={(e) => handleTimeChange(dayIndex, itemIndex, 'stayDuration', e.target.value)}
                                    />
                                    <em>分钟</em>
                                  </label>
                                </div>
                                <button className="item-delete" onClick={() => removeFromDay(dayIndex, item.id)}>×</button>
                              </div>
                              <div className="homework-block">
                                <div className="homework-header">
                                  <span>抄作业</span>
                                  <a
                                    href={createXiaohongshuSearchUrl(item)}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    去小红书搜这个地点
                                  </a>
                                </div>
                                <div className="homework-links">
                                  {getHomeworkLinks(item).map((link, linkIndex) => (
                                    <div className="homework-input-row" key={`${item.id}-homework-${linkIndex}`}>
                                      <input
                                        type="url"
                                        placeholder="粘贴你选中的小红书原帖链接"
                                        value={link}
                                        onChange={(e) => updateHomeworkLinkAt(dayIndex, itemIndex, linkIndex, e.target.value)}
                                      />
                                      {link && (
                                        <a
                                          className="homework-open"
                                          href={link}
                                          target="_blank"
                                          rel="noreferrer"
                                        >
                                          打开
                                        </a>
                                      )}
                                      {getHomeworkLinks(item).length > 1 && (
                                        <button
                                          type="button"
                                          className="homework-remove"
                                          onClick={() => removeHomeworkLink(dayIndex, itemIndex, linkIndex)}
                                        >
                                          ×
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                                <button
                                  type="button"
                                  className="homework-add"
                                  onClick={() => addHomeworkLink(dayIndex, itemIndex)}
                                >
                                  + 添加链接
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* 添加按钮 */}
        <div className="trip-edit-footer">
          <button className="add-item-btn" onClick={() => {
            setAddTargetDayIndex(null)
            setShowAddModal(true)
          }}>
            <span>+</span>
            <span>添加地点/住宿/交通</span>
          </button>
          <button className="save-btn" onClick={handleSave}>保存</button>
        </div>
      </div>

      {/* 左侧地图 */}
      <div className="trip-edit-map">
        <div id="trip-edit-map" ref={mapRef}></div>
      </div>

      {/* 添加弹窗 */}
      {showAddModal && (
        <div className="add-modal-overlay" onClick={closeAddModal}>
          <div className="add-modal" onClick={e => e.stopPropagation()}>
            <div className="add-modal-header">
              <div className="add-type-tabs">
                <button
                  className={addType === 'spot' ? 'active' : ''}
                  onClick={() => setAddType('spot')}
                >
                  添加景点
                </button>
                <button
                  className={addType === 'hotel' ? 'active' : ''}
                  onClick={() => setAddType('hotel')}
                >
                  添加住宿
                </button>
                <button
                  className={addType === 'transport' ? 'active' : ''}
                  onClick={() => setAddType('transport')}
                >
                  添加交通
                </button>
              </div>
              <button className="add-modal-close" onClick={() => setShowAddModal(false)}>×</button>
            </div>
            {addTargetDayIndex !== null && (
              <div className="add-modal-target-tip">
                添加后会直接放入{getDayLabel(addTargetDayIndex + 1)}
              </div>
            )}
            <div className="add-modal-search">
              <input
                type="text"
                placeholder="搜索地点..."
                value={searchKeyword}
                onChange={e => setSearchKeyword(e.target.value)}
                autoFocus
              />
            </div>
            <div className="add-modal-results">
              {searching && <div className="searching">搜索中...</div>}
              {searchResults.map((result, index) => (
                <div
                  key={index}
                  className="search-result-item"
                  onClick={() => handleAddItem(result)}
                >
                  <div className="result-name">{result.name}</div>
                  <div className="result-address">{result.address || result.cityname}</div>
                </div>
              ))}
              {!searching && searchKeyword && searchResults.length === 0 && (
                <div className="no-results">未找到相关地点</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TripEdit
