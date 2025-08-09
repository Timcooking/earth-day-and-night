// data/floors.js — 楼层示例数据与模板
// 用对象键保存 1..128 层，便于按层号索引。

export const FLOORS = {
  1: { name: '大堂与商业', type: '商业配套', description: '挑高大堂与商业设施，游客接待、导览、餐饮与零售。', image: '' },
  2: { name: '会议中心', type: '会议', description: '多功能会议空间与报告厅，支持企业活动与展览。', image: '' },
  5: { name: '裙楼商业', type: '商业', description: '精品零售与美食，连接地铁与公共空间。', image: '' },
  33: { name: '写字楼', type: '办公', description: '甲级办公区，智能化楼宇，绿色节能。', image: '' },
  52: { name: '空中大堂', type: '转换层', description: '竖向交通转换与休憩空间，瞭望城市天际线。', image: '' },
  66: { name: '观光层', type: '观景', description: '热门观光层，设有互动装置与城市展览。', image: '' },
  90: { name: '酒店大堂', type: '酒店', description: '高空酒店大堂，配套餐饮与服务。', image: '' },
  101: { name: '酒店客房', type: '酒店', description: '景观客房，俯瞰浦江两岸与城市群。', image: '' },
  120: { name: '观景台', type: '观景', description: '高层观景平台，可远眺城市、云海与日落。', image: '' },
  128: { name: '机房层', type: '设备', description: '塔冠设备与维护层，非对外开放。', image: '' },
};

// 其余未定义楼层使用占位描述，UI 调用时处理为空或默认文本。
