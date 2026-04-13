import { useState, useEffect } from 'react'

// 完整城市列表（含省份）
const CITIES_BY_REGION = {
  '北京': ['北京'],
  '上海': ['上海'],
  '天津': ['天津'],
  '重庆': ['重庆'],
  '内蒙古': ['呼和浩特', '包头', '鄂尔多斯', '赤峰', '呼伦贝尔'],
  '广西': ['南宁', '桂林', '柳州', '北海', '梧州'],
  '西藏': ['拉萨', '日喀则', '林芝'],
  '宁夏': ['银川', '石嘴山', '吴忠'],
  '新疆': ['乌鲁木齐', '克拉玛依', '吐鲁番', '伊犁'],
  '香港': ['香港'],
  '澳门': ['澳门'],
  '河北': ['石家庄', '唐山', '保定', '秦皇岛', '张家口'],
  '山西': ['太原', '大同', '平遥', '朔州', '运城'],
  '辽宁': ['沈阳', '大连', '鞍山', '抚顺', '丹东'],
  '吉林': ['长春', '吉林', '延吉', '四平'],
  '黑龙江': ['哈尔滨', '大庆', '齐齐哈尔', '牡丹江'],
  '江苏': ['南京', '苏州', '无锡', '扬州', '常州', '南通', '徐州', '昆山', '周庄', '同里'],
  '浙江': ['杭州', '宁波', '温州', '嘉兴', '绍兴', '金华', '乌镇', '西塘', '千岛湖', '舟山'],
  '安徽': ['合肥', '黄山', '九华山', '宏村', '西递', '芜湖'],
  '福建': ['福州', '厦门', '泉州', '武夷山', '漳州'],
  '江西': ['南昌', '赣州', '九江', '上饶', '景德镇', '井冈山', '婺源', '庐山'],
  '山东': ['济南', '青岛', '威海', '烟台', '泰山', '曲阜', '蓬莱'],
  '河南': ['郑州', '洛阳', '开封', '少林寺', '云台山'],
  '湖北': ['武汉', '宜昌', '襄阳', '张家界', '武当山', '凤凰'],
  '湖南': ['长沙', '张家界', '凤凰', '岳阳', '衡山'],
  '广东': ['广州', '深圳', '珠海', '东莞', '佛山', '中山', '惠州', '汕头', '湛江'],
  '海南': ['海口', '三亚', '五指山', '三沙'],
  '四川': ['成都', '九寨沟', '峨眉山', '稻城', '亚丁', '色达', '乐山', '康定'],
  '贵州': ['贵阳', '黄果树', '遵义', '西江千户苗寨', '镇远'],
  '云南': ['昆明', '大理', '丽江', '香格里拉', '西双版纳', '泸沽湖', '腾冲', '瑞丽'],
  '陕西': ['西安', '延安', '华山', '兵马俑', '乾陵'],
  '甘肃': ['兰州', '敦煌', '嘉峪关', '张掖', '天水'],
  '青海': ['西宁', '青海湖', '茶卡盐湖', '格尔木'],
  '台湾': ['台北', '高雄', '台中', '垦丁', '花莲']
}

// 所有可选城市（扁平列表）
const ALL_CITIES = Object.values(CITIES_BY_REGION).flat()

function CreateTripModal({ onClose, onConfirm }) {
  const [step, setStep] = useState(1)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [citySearch, setCitySearch] = useState('')
  const [selectedCities, setSelectedCities] = useState([])
  const [searchResults, setSearchResults] = useState([])
  const [provinceCities, setProvinceCities] = useState([])
  const [searching, setSearching] = useState(false)

  // 搜索城市
  useEffect(() => {
    const timer = setTimeout(() => {
      if (citySearch.trim()) {
        searchCities(citySearch)
      } else {
        setSearchResults([])
        setProvinceCities([])
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [citySearch])

  const searchCities = async (keyword) => {
    setSearching(true)
    setProvinceCities([])

    // 先检查是否是省份名
    const matchedProvince = Object.keys(CITIES_BY_REGION).find(
      p => p.includes(keyword) || keyword.includes(p)
    )

    if (matchedProvince) {
      // 如果匹配到省份，返回省份本身
      setSearchResults([matchedProvince])

      // 获取该省份下的城市，按首字母排序
      const cities = CITIES_BY_REGION[matchedProvince] || []
      setProvinceCities([...cities].sort((a, b) => a.localeCompare(b, 'zh-CN')))
    } else {
      // 否则搜索所有城市
      const matchedCities = ALL_CITIES.filter(city =>
        city.includes(keyword)
      ).sort((a, b) => a.localeCompare(b, 'zh-CN'))

      setSearchResults(matchedCities.slice(0, 15))
    }

    setSearching(false)
  }

  // 处理城市选择
  const toggleCity = (city) => {
    if (selectedCities.includes(city)) {
      setSelectedCities(selectedCities.filter(c => c !== city))
    } else {
      setSelectedCities([...selectedCities, city])
    }
  }

  // 起始日期变化时，清除结束日期
  const handleStartDateChange = (e) => {
    const newStart = e.target.value
    setStartDate(newStart)
    if (endDate && new Date(endDate) < new Date(newStart)) {
      setEndDate('')
    }
  }

  // 检查日期是否有效
  const isDateValid = () => {
    if (!startDate || !endDate) return false
    return new Date(endDate) >= new Date(startDate)
  }

  const canProceed = () => {
    if (step === 1) {
      return startDate && endDate && isDateValid()
    }
    if (step === 2) {
      return selectedCities.length > 0
    }
    return false
  }

  const handleConfirm = () => {
    if (step === 1) {
      setStep(2)
    } else {
      onConfirm({
        startDate,
        endDate,
        cities: selectedCities
      })
    }
  }

  const handleBack = () => {
    if (step === 2) {
      setStep(1)
    } else {
      onClose()
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{step === 1 ? '选择日期' : '选择城市'}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-step-indicator">
          <span className={step >= 1 ? 'active' : ''}>1</span>
          <span className={`step-line ${step >= 2 ? 'active' : ''}`}></span>
          <span className={step >= 2 ? 'active' : ''}>2</span>
        </div>

        <div className="modal-body">
          {step === 1 && (
            <div className="date-selection">
              <div className="date-field">
                <label>出发日期</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={handleStartDateChange}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div className="date-field">
                <label>返回日期</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  min={startDate || undefined}
                />
              </div>
              {startDate && endDate && !isDateValid() && (
                <div className="date-error">返回日期必须在出发日期之后</div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="city-selection">
              <div className="city-search-wrapper">
                <input
                  type="text"
                  className="city-search"
                  placeholder="输入省或城市名称..."
                  value={citySearch}
                  onChange={e => setCitySearch(e.target.value)}
                  autoFocus
                />
                {searching && <span className="searching">搜索中...</span>}
              </div>

              <div className="selected-cities">
                {selectedCities.map(city => (
                  <span key={city} className="city-tag" onClick={() => toggleCity(city)}>
                    {city} ×
                  </span>
                ))}
              </div>

              <div className="city-list">
                {/* 如果搜索结果是省份，显示省份并列出该省城市 */}
                {provinceCities.length > 0 && (
                  <div className="province-section">
                    <div className="province-header">省份</div>
                    <div className="province-cities">
                      <button
                        className={`city-item province-item ${selectedCities.includes(searchResults[0]) ? 'selected' : ''}`}
                        onClick={() => toggleCity(searchResults[0])}
                      >
                        {searchResults[0]}
                      </button>
                    </div>
                    <div className="province-header" style={{marginTop: '12px'}}>该省城市（按首字母排序）</div>
                    <div className="province-cities">
                      {provinceCities.map(city => (
                        <button
                          key={city}
                          className={`city-item ${selectedCities.includes(city) ? 'selected' : ''}`}
                          onClick={() => toggleCity(city)}
                        >
                          {city}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 普通城市搜索结果 */}
                {provinceCities.length === 0 && searchResults.length > 0 && (
                  <div className="city-results">
                    {searchResults.map(city => (
                      <button
                        key={city}
                        className={`city-item ${selectedCities.includes(city) ? 'selected' : ''}`}
                        onClick={() => toggleCity(city)}
                      >
                        {city}
                      </button>
                    ))}
                  </div>
                )}

                {/* 无结果 */}
                {citySearch && searchResults.length === 0 && !searching && provinceCities.length === 0 && (
                  <div className="city-empty">未找到 "{citySearch}"</div>
                )}

                {/* 默认提示 */}
                {!citySearch && selectedCities.length === 0 && (
                  <div className="city-hint">请输入省或城市名称搜索</div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="modal-btn secondary" onClick={handleBack}>
            {step === 1 ? '取消' : '上一步'}
          </button>
          <button
            className="modal-btn primary"
            disabled={!canProceed()}
            onClick={handleConfirm}
          >
            {step === 1 ? '下一步' : '完成'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default CreateTripModal