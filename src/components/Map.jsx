import { useEffect, useRef, useState, useCallback } from 'react'
import './Map.css'

const AMap_KEY = 'e2c347ab0fa80da1220c9650bd4492e6'

function Map() {
  const [pois, setPois] = useState([])
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [userMarkers, setUserMarkers] = useState([])
  const [routePath, setRoutePath] = useState(null)
  const [showRoute, setShowRoute] = useState(false)
  const mapInstance = useRef(null)
  const markersRef = useRef([])
  const routeRef = useRef(null)

  const clearMarkers = () => {
    if (mapInstance.current && markersRef.current.length > 0) {
      mapInstance.current.remove(markersRef.current)
      markersRef.current = []
    }
  }

  const clearUserMarkers = () => {
    if (mapInstance.current && userMarkers.length > 0) {
      userMarkers.forEach(marker => {
        if (marker.marker) {
          mapInstance.current.remove(marker.marker)
        }
      })
      setUserMarkers([])
    }
  }

  const clearRoute = () => {
    if (mapInstance.current && routeRef.current) {
      mapInstance.current.remove(routeRef.current)
      routeRef.current = null
      setRoutePath(null)
      setShowRoute(false)
    }
  }

  const addUserMarker = (position, name) => {
    if (!mapInstance.current) return

    const marker = new window.AMap.Marker({
      position: position,
      title: name,
      icon: new window.AMap.Icon({
        size: new window.AMap.Size(30, 30),
        image: 'https://a.amap.com/jsapi_demos/static/demo-center/icons/poi-marker-default.png',
        imageSize: new window.AMap.Size(30, 30)
      })
    })

    const infoWindow = new window.AMap.InfoWindow({
      content: `
        <div style="padding:8px;min-width:200px">
          <h3 style="margin:0 0 8px;font-size:14px">${name}</h3>
          <p style="margin:0;color:#666;font-size:12px">点击清除按钮删除此标记</p>
        </div>
      `,
      offset: new window.AMap.Pixel(0, -30)
    })

    marker.on('click', () => {
      infoWindow.open(mapInstance.current, marker.getPosition())
    })

    mapInstance.current.add(marker)

    const newMarker = {
      id: Date.now().toString(),
      name: name,
      position: position,
      marker: marker
    }

    setUserMarkers(prev => [...prev, newMarker])
  }

  const generateRoute = () => {
    if (!mapInstance.current || userMarkers.length < 2) {
      setError('请至少添加2个标记点以生成路线')
      setTimeout(() => setError(''), 3000)
      return
    }

    clearRoute()

    const path = userMarkers.map(marker => marker.position)
    setRoutePath(path)

    const polyline = new window.AMap.Polyline({
      path: path,
      strokeColor: '#ff6b35',
      strokeWeight: 4,
      strokeOpacity: 0.8,
      lineJoin: 'round'
    })

    mapInstance.current.add(polyline)
    routeRef.current = polyline
    setShowRoute(true)

    // 调整地图视野以显示整个路线
    mapInstance.current.setFitView()
  }

  const addMarkers = (poiList) => {
    if (!mapInstance.current) return
    clearMarkers()

    poiList.forEach(poi => {
      if (!poi.location) return

      const marker = new window.AMap.Marker({
        position: [poi.location.lng, poi.location.lat],
        title: poi.name
      })

      const infoWindow = new window.AMap.InfoWindow({
        content: `
          <div style="padding:8px;min-width:200px">
            <h3 style="margin:0 0 8px;font-size:14px">${poi.name}</h3>
            <p style="margin:0;color:#666;font-size:12px">${poi.address || '暂无地址'}</p>
          </div>
        `,
        offset: new window.AMap.Pixel(0, -30)
      })

      marker.on('click', () => {
        infoWindow.open(mapInstance.current, marker.getPosition())
      })

      mapInstance.current.add(marker)
      markersRef.current.push(marker)
    })
  }

  const searchPOI = useCallback(async (keyword) => {
    if (!keyword.trim()) return
    if (!mapInstance.current) {
      setError('地图加载中，请稍候...')
      setTimeout(() => setError(''), 2000)
      return
    }

    setLoading(true)
    setError('')
    clearMarkers()

    try {
      const response = await fetch(
        `https://restapi.amap.com/v3/place/text?keywords=${encodeURIComponent(keyword)}&city=全国&offset=20&page=1&key=${AMap_KEY}`
      )
      const data = await response.json()

      console.log('搜索结果:', data)

      if (data.status === '1' && data.pois && data.pois.length > 0) {
        const formattedPois = data.pois.map(poi => ({
          name: poi.name,
          address: poi.address,
          location: poi.location ? {
            lng: parseFloat(poi.location.split(',')[0]),
            lat: parseFloat(poi.location.split(',')[1])
          } : null,
          type: poi.type
        })).filter(poi => poi.location)

        setPois(formattedPois)
        addMarkers(formattedPois)
        if (formattedPois.length > 0) {
          mapInstance.current.setFitView()
        }
      } else {
        setPois([])
        setError(data.info || '未找到结果')
        setTimeout(() => setError(''), 3000)
      }
    } catch (err) {
      console.error('搜索失败:', err)
      setError('搜索请求失败')
      setTimeout(() => setError(''), 2000)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const initMap = () => {
      const container = document.getElementById('amap-container')
      if (!container) return

      const map = new window.AMap.Map('amap-container', {
        zoom: 5,
        center: [104.1954, 35.8617],
        mapStyle: 'amap://styles/normal'
      })

      mapInstance.current = map

      // 默认标记
      const marker = new window.AMap.Marker({
        position: [104.1954, 35.8617],
        title: '中国'
      })
      map.add(marker)

      // 点击地图添加标记点
      map.on('click', (e) => {
        const lng = e.lnglat.getLng()
        const lat = e.lnglat.getLat()
        const position = [lng, lat]

        // 逆地理编码获取地址
        fetch(`https://restapi.amap.com/v3/geocode/regeo?location=${lng},${lat}&key=${AMap_KEY}`)
          .then(res => res.json())
          .then(data => {
            if (data.status === '1' && data.regeocode) {
              const name = data.regeocode.formatted_address || '未命名地点'
              addUserMarker(position, name)
            }
          })
      })

      console.log('地图加载完成')
    }

    if (window.AMap) {
      initMap()
    } else {
      const script = document.createElement('script')
      script.src = `https://webapi.amap.com/maps?v=1.4.15&key=${AMap_KEY}`
      script.async = true
      script.onload = initMap
      script.onerror = () => setError('地图加载失败')
      document.head.appendChild(script)
    }

    return () => {
      if (mapInstance.current) {
        mapInstance.current.destroy()
        mapInstance.current = null
      }
    }
  }, [])

  return (
    <div className="map-page">
      <header className="map-header">
        <div className="search-bar">
          <input
            type="text"
            placeholder="搜索景点、酒店、美食、商店..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && searchPOI(keyword)}
          />
          <button onClick={() => searchPOI(keyword)} disabled={loading}>
            {loading ? '搜索中...' : '搜索'}
          </button>
        </div>
        {error && <div className="search-error">{error}</div>}
        
        {/* 地图工具按钮 */}
        <div className="map-tools">
          {userMarkers.length > 0 && (
            <>
              <button className="tool-btn" onClick={generateRoute} disabled={userMarkers.length < 2}>
                🗺️ 生成路线
              </button>
              <button className="tool-btn" onClick={clearUserMarkers}>
                🗑️ 清除标记
              </button>
            </>
          )}
          {showRoute && (
            <button className="tool-btn" onClick={clearRoute}>
              🚫 清除路线
            </button>
          )}
        </div>
      </header>
      <main className="map-container">
        <div id="amap-container" className="amap-wrapper"></div>
      </main>
      
      {/* 搜索结果 */}
      {pois.length > 0 && (
        <aside className="poi-list">
          <h3>搜索结果 ({pois.length})</h3>
          <ul>
            {pois.map((poi, index) => (
              <li key={index} onClick={() => {
                if (mapInstance.current && poi.location) {
                  mapInstance.current.setZoom(15)
                  mapInstance.current.setCenter([poi.location.lng, poi.location.lat])
                }
              }}>
                <strong>{poi.name}</strong>
                <span>{poi.address || (poi.district ? poi.district : '暂无地址')}</span>
              </li>
            ))}
          </ul>
        </aside>
      )}
      
      {/* 用户标记点列表 */}
      {userMarkers.length > 0 && (
        <aside className="user-markers-list">
          <h3>我的标记 ({userMarkers.length})</h3>
          <ul>
            {userMarkers.map((marker) => (
              <li key={marker.id} onClick={() => {
                if (mapInstance.current) {
                  mapInstance.current.setZoom(15)
                  mapInstance.current.setCenter(marker.position)
                }
              }}>
                <strong>{marker.name}</strong>
                <span>{marker.position[0].toFixed(4)}, {marker.position[1].toFixed(4)}</span>
              </li>
            ))}
          </ul>
        </aside>
      )}
    </div>
  )
}

export default Map