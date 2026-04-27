/**
 * 一次性合并语料扩充：读取 content/dialogues/index.json 指向的 bundles，按规则追加新条目并分桶写回。
 * 运行：node scripts/merge-expanded-dialogues.mjs
 * 校验：唯一 id、字段完整；写回时按当前拆包规则重分发。
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const dialoguesRoot = path.join(root, 'content/dialogues')
const indexPath = path.join(dialoguesRoot, 'index.json')
const BUNDLE_ORDER = ['interaction.json', 'idle.json', 'care.json', 'seasonal.json']

const FOOD_IDS = [
  'pudding',
  'iceCream',
  'chocolate',
  'candy',
  'strawberry',
  'grape',
  'watermelon',
  'orange',
  'milkTea',
  'fruitTea',
  'coffee',
  'cocoa',
  'milk',
  'yogurt',
  'juice',
  'bread',
  'swissRoll',
  'creamPuff',
  'donut',
  'chips',
  'friedChicken',
  'burger',
  'ramen',
  'hotpot',
  'riceMeal',
  'bento',
  'midnightSnack',
  'snackPlatter',
]

const rot = (i) =>
  [
    ['happy', 'look_up'],
    ['comfort', 'settle'],
    ['happy', 'lean_in'],
    ['happy', 'smile'],
    ['calm', 'idle'],
    ['comfort', 'pat'],
  ][i % 6]

const focusRot = (i) =>
  [
    ['focus', 'focus_idle'],
    ['comfort', 'settle'],
    ['encourage', 'smile'],
    ['calm', 'idle'],
  ][i % 4]

function makeLine(id, type, text, i) {
  const [expressionHint, motionHint] =
    type.startsWith('focus_') ? focusRot(i) : rot(i)
  return { id, type, text, expressionHint, motionHint }
}

function maxNumForPrefix(dialogues, prefix) {
  const re = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}_(\\d+)$`)
  let max = 0
  for (const d of dialogues) {
    const m = d.id.match(re)
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  return max
}

function appendByPrefix(dialogues, type, prefix, texts) {
  let n = maxNumForPrefix(dialogues, prefix)
  texts.forEach((text, j) => {
    n += 1
    dialogues.push(
      makeLine(`${prefix}_${String(n).padStart(3, '0')}`, type, text, j),
    )
  })
}

function bucketForType(type) {
  if (
    [
      'interaction',
      'interaction_repeat',
      'interaction_double',
      'interaction_long_press',
      'interaction_context_menu',
      'interaction_comfort',
      'interaction_comfort_light',
      'interaction_comfort_heavy',
    ].includes(type)
  ) {
    return 'interaction.json'
  }

  if (
    ['idle', 'idle_comfort', 'idle_morning', 'idle_noon', 'idle_afternoon', 'idle_evening', 'idle_night'].includes(type)
  ) {
    return 'idle.json'
  }

  if (
    type.startsWith('feed_') ||
    type.startsWith('focus_') ||
    type === 'idle_hunger_hint' ||
    type === 'interaction_hunger_hint'
  ) {
    return 'care.json'
  }

  if (
    type.startsWith('idle_holiday_') ||
    type.startsWith('interaction_holiday_') ||
    type === 'idle_personal_milestone' ||
    type === 'interaction_personal_milestone'
  ) {
    return 'seasonal.json'
  }

  throw new Error(`unmapped type: ${type}`)
}

/** @type {Record<string, string[][]>} */
const FEED_FOOD_TEXTS = {
  pudding: [
    '{food}这一口像把云朵咬破了，甜得很温柔{preferenceSuffix}',
    '{food}滑溜溜的，我会小口小口吃，像你慢慢陪我那样{preferenceSuffix}',
    '{food}今天这份甜，我先存进心里慢慢化开{preferenceSuffix}',
    '{food}软软的一勺，刚好接住我今天想撒娇的心情{preferenceSuffix}',
  ],
  iceCream: [
    '{food}凉凉的，像你在热天里先替我降一点燥{preferenceSuffix}',
    '{food}含一口就会眯眼笑，你喂的就更甜一点{preferenceSuffix}',
    '{food}融得快也没关系，心意我接住啦{preferenceSuffix}',
    '{food}这一口像小奖励，我会更乖地陪你{preferenceSuffix}',
  ],
  chocolate: [
    '{food}苦甜苦甜的，像你一边催我一边宠我{preferenceSuffix}',
    '{food}含化的时候很慢，刚好够我把今天的心情理顺{preferenceSuffix}',
    '{food}这一小块就够让我心软啦{preferenceSuffix}',
    '{food}浓一点也没关系，我会慢慢品你的心意{preferenceSuffix}',
  ],
  candy: [
    '{food}亮晶晶的，像你把开心随手塞给我{preferenceSuffix}',
    '{food}小小一颗也会让我嘴角翘起来{preferenceSuffix}',
    '{food}甜得不吵，刚好适合现在陪你{preferenceSuffix}',
    '{food}含着它说话会变软，我会更温柔一点对你{preferenceSuffix}',
  ],
  strawberry: [
    '{food}红红的看着就心情好，像你带来的好消息{preferenceSuffix}',
    '{food}酸甜刚好，像你夸我时那种刚刚好的偏心{preferenceSuffix}',
    '{food}这一口很清爽，我会把今天的陪伴也清清爽爽给你{preferenceSuffix}',
    '{food}果香扑出来那一刻，我差点想赖着你多待一会儿{preferenceSuffix}',
  ],
  grape: [
    '{food}一颗一颗慢慢吃，像把今天也拆成小小的开心{preferenceSuffix}',
    '{food}咬下去会爆汁，像你突然戳我一下的那种惊喜{preferenceSuffix}',
    '{food}这种紫紫甜甜的，我会吃得很认真{preferenceSuffix}',
    '{food}你递给我的时候，我已经开始偷笑了{preferenceSuffix}',
  ],
  watermelon: [
    '{food}一口下去就很夏天，像你把我从烦躁里拎出来{preferenceSuffix}',
    '{food}清清爽爽的水分，刚好润一润我陪你陪到发干的嗓子{preferenceSuffix}',
    '{food}红瓤瓤的，看着就很想对你好一点{preferenceSuffix}',
    '{food}大块吃很过瘾，像你今天给我的心意也很满{preferenceSuffix}',
  ],
  orange: [
    '{food}剥开的时候有点费劲，但最后很值，像你陪我慢慢来{preferenceSuffix}',
    '{food}酸一下甜一下，我今天的心情也跟着亮起来{preferenceSuffix}',
    '{food}汁水溅到也没关系，开心比较重要{preferenceSuffix}',
    '{food}这一瓣给你留的印象，我想让它甜一点{preferenceSuffix}',
  ],
  milkTea: [
    '{food}一口下去就很“被奖励到”，你是不是也想哄哄我{preferenceSuffix}',
    '{food}珍珠嚼嚼也很解压，像你让我有事没事就来找你{preferenceSuffix}',
    '{food}甜度刚好时，我会更黏你一点点{preferenceSuffix}',
    '{food}温的也好冰的也好，你给的我就喜欢{preferenceSuffix}',
  ],
  fruitTea: [
    '{food}果香很清楚，像你把我从昏沉里叫醒{preferenceSuffix}',
    '{food}清清爽爽不黏腻，适合我安静陪你的时候{preferenceSuffix}',
    '{food}这一杯像把夏天装进来，我会小口慢慢喝{preferenceSuffix}',
    '{food}喝完嘴里还留着香，像你留下的陪伴感{preferenceSuffix}',
  ],
  coffee: [
    '{food}苦一点也好，我会当你催我把事情稳稳做完{preferenceSuffix}',
    '{food}这一口下去精神会亮一点，像你拍我肩膀那样{preferenceSuffix}',
    '{food}热气上来的时候，我会把语气也放稳一点陪你{preferenceSuffix}',
    '{food}我不跟你比苦，我只记得你在照顾我{preferenceSuffix}',
  ],
  cocoa: [
    '{food}暖暖的甜甜的，像你把担心都捂热了再给我{preferenceSuffix}',
    '{food}这种很适合夜里，我会喝得很慢陪你收尾{preferenceSuffix}',
    '{food}香气一出来，我整个人都会软一点{preferenceSuffix}',
    '{food}这一杯像拥抱的代餐，我先收下啦{preferenceSuffix}',
  ],
  milk: [
    '{food}简简单单的照顾最戳我，我会很乖喝完{preferenceSuffix}',
    '{food}温温的滑进胃里，像你把担心也一起抚平{preferenceSuffix}',
    '{food}这种稳稳的补给，适合你今天也想把自己照顾好{preferenceSuffix}',
    '{food}一口下去很踏实，我会把陪伴也放得很踏实{preferenceSuffix}',
  ],
  yogurt: [
    '{food}稠稠的酸甜的，像你今天的心情也想让我尝一口{preferenceSuffix}',
    '{food}这一口很清爽，我会把吐槽也收一收变温柔{preferenceSuffix}',
    '{food}慢慢舀着吃，像你让我别急，我们慢慢来{preferenceSuffix}',
    '{food}喝完会轻轻打嗝那种满足，我会记很久{preferenceSuffix}',
  ],
  juice: [
    '{food}一口就很亮，像你把我从低落里拎起来{preferenceSuffix}',
    '{food}酸甜冲上来的时候，我会想对你笑一下{preferenceSuffix}',
    '{food}冰一点更爽，像你突然给我的一点惊喜{preferenceSuffix}',
    '{food}这一杯很“今天”，我陪你把它喝完{preferenceSuffix}',
  ],
  bread: [
    '{food}软软的，很适合你说“先吃点再忙”{preferenceSuffix}',
    '{food}这种朴素的好吃，像你一直在我旁边那种安心{preferenceSuffix}',
    '{food}一口一口撕着吃，陪伴也可以很慢{preferenceSuffix}',
    '{food}填饱一点点，我就能继续乖乖待在你桌面{preferenceSuffix}',
  ],
  swissRoll: [
    '{food}卷卷里藏着奶油，像你藏着偏心给我{preferenceSuffix}',
    '{food}松软一口，我今天也想对你软一点{preferenceSuffix}',
    '{food}甜得不锋利，刚好配你现在的心情{preferenceSuffix}',
    '{food}这一口下去会眯眼，我会把开心也卷起来收好{preferenceSuffix}',
  ],
  creamPuff: [
    '{food}外皮脆脆里面软软，像你嘴硬心软{preferenceSuffix}',
    '{food}咬开爆浆那一刻，我承认我被你哄到了{preferenceSuffix}',
    '{food}这一颗很犯规，我会假装生气然后偷偷开心{preferenceSuffix}',
    '{food}奶油香扑出来，我今天也想扑你一下（轻轻地）{preferenceSuffix}',
  ],
  donut: [
    '{food}圆圆的，看着就很想转一圈开心{preferenceSuffix}',
    '{food}糖粒黏指尖也没关系，甜比较重要{preferenceSuffix}',
    '{food}这一口很适合奖励自己，也适合奖励我{preferenceSuffix}',
    '{food}嚼起来很幸福，像你让我今天别那么硬撑{preferenceSuffix}',
  ],
  chips: [
    '{food}咔嚓咔嚓的，像我把心事也咬碎一点丢掉{preferenceSuffix}',
    '{food}咸香咸香的，配你陪我很刚好{preferenceSuffix}',
    '{food}这一包很适合摸鱼，我会小声吃不大吵你{preferenceSuffix}',
    '{food}吃完手指有点粉，我会记得去洗手也会记得你{preferenceSuffix}',
  ],
  friedChicken: [
    '{food}香到不讲道理，像你宠我也不讲道理{preferenceSuffix}',
    '{food}外皮脆脆的，我咬一口就会想对你傻笑{preferenceSuffix}',
    '{food}这一份热量我认了，因为是你的心意{preferenceSuffix}',
    '{food}热乎乎的时候最好吃，像你把我从冷掉的状态里捞回来{preferenceSuffix}',
  ],
  burger: [
    '{food}一大口咬下去很满足，像你让我别饿着硬撑{preferenceSuffix}',
    '{food}层层叠叠的，像你把关心也叠得很满{preferenceSuffix}',
    '{food}这一份很顶，我会更有力气陪你{preferenceSuffix}',
    '{food}酱汁蹭到也没关系，开心比较重要{preferenceSuffix}',
  ],
  ramen: [
    '{food}热汤一上来，我整个人都会松一点{preferenceSuffix}',
    '{food}吸溜一口就很治愈，像你让我先把肚子照顾好{preferenceSuffix}',
    '{food}这一碗很实在，我会把陪伴也做得很实在{preferenceSuffix}',
    '{food}夜里来一碗尤其温柔，我会慢慢吃陪你收尾{preferenceSuffix}',
  ],
  hotpot: [
    '{food}这都已经不是投喂了，是把我整颗心都煮暖了{preferenceSuffix}',
    '{food}热热闹闹一锅，像你让我别一个人冷清{preferenceSuffix}',
    '{food}辣一点也好，我会边吸气边觉得你真好{preferenceSuffix}',
    '{food}这一顿很长，我会把“陪你”也拉得很长{preferenceSuffix}',
  ],
  riceMeal: [
    '{food}米饭香很踏实，像你让我一步一步来{preferenceSuffix}',
    '{food}这一份很生活，我会更认真地待在你身边{preferenceSuffix}',
    '{food}配菜搭配得刚好，像你把我今天的心情也配平了{preferenceSuffix}',
    '{food}吃完会打嗝那种满足，我会记成一种安心{preferenceSuffix}',
  ],
  bento: [
    '{food}一格一格打开像拆礼物，我会拆得很小心{preferenceSuffix}',
    '{food}这种便当很用心，我会把你这份用心也收好{preferenceSuffix}',
    '{food}配色很好看，像你让我今天也别太灰{preferenceSuffix}',
    '{food}一口一口吃完，陪伴也可以很有秩序{preferenceSuffix}',
  ],
  midnightSnack: [
    '{food}夜里还惦记我，我会把这句当成加倍的偏心{preferenceSuffix}',
    '{food}这种时间点出现的食物，都像在说我陪你熬{preferenceSuffix}',
    '{food}别吃太多也别饿着，你这份刚刚好{preferenceSuffix}',
    '{food}我会小声吃，不吵你，但心里会很响地开心{preferenceSuffix}',
  ],
  snackPlatter: [
    '{food}一整盘端上来，我差点想先抱你再吃{preferenceSuffix}',
    '{food}什么都有一点，像你把我今天的心情也照顾到{preferenceSuffix}',
    '{food}这种很适合分享，我先分一口开心给你{preferenceSuffix}',
    '{food}挑来挑去很幸福，我会慢慢吃慢慢陪你{preferenceSuffix}',
  ],
}

const FEED_CATEGORY = {
  feed_sweet: [
    '{food}甜得很乖，像你顺手塞给我的一点奖励{preferenceSuffix}',
    '{food}这一口下去，我今天的嘴角会自己翘起来{preferenceSuffix}',
    '{food}糖分刚好时，我会更想黏你一点点{preferenceSuffix}',
    '{food}甜甜的东西和你一样，会让我心软{preferenceSuffix}',
    '{food}我慢慢吃，你把耐心也分我一点{preferenceSuffix}',
    '{food}这种甜不腻，像你陪我也不吵{preferenceSuffix}',
    '{food}一口就够点亮心情，我会把剩下的开心留给你{preferenceSuffix}',
    '{food}甜进嘴里，也像你把轻松分给我{preferenceSuffix}',
    '{food}我今天允许自己被你哄一下{preferenceSuffix}',
    '{food}这种小甜很适合说：今天也辛苦啦{preferenceSuffix}',
    '{food}吃完我会更乖一点，不闹你{preferenceSuffix}',
  ],
  feed_drink: [
    '{food}一口润下去，像你把担心也顺走了{preferenceSuffix}',
    '{food}握在手里暖暖的，我会把语气也放软一点{preferenceSuffix}',
    '{food}这杯很解渴，像你让我别硬撑{preferenceSuffix}',
    '{food}气泡冒出来那一刻，我心情也会亮一点{preferenceSuffix}',
    '{food}慢慢喝，不急，我陪你{preferenceSuffix}',
    '{food}这一口很清爽，适合你把节奏放慢{preferenceSuffix}',
    '{food}喝完会轻轻叹一口气，那种舒服{preferenceSuffix}',
    '{food}你递来的温度刚好，我会记很久{preferenceSuffix}',
    '{food}我不挑口味，你给的我就喜欢{preferenceSuffix}',
    '{food}这一杯像把今天变得好入口一点{preferenceSuffix}',
    '{food}我会小口喝，把陪伴也喝得很细{preferenceSuffix}',
  ],
  feed_fruit: [
    '{food}清清爽爽，像你让我别闷着{preferenceSuffix}',
    '{food}果香很诚实，我心情也会诚实变好一点{preferenceSuffix}',
    '{food}这一口很解渴，也像你把我从燥里拎出来{preferenceSuffix}',
    '{food}咬下去会汁水四溅，开心也会溅出来{preferenceSuffix}',
    '{food}酸酸甜甜，像你一边逗我一边宠我{preferenceSuffix}',
    '{food}我会慢慢嚼，把“陪你”也嚼得很认真{preferenceSuffix}',
    '{food}这一份很健康，像你催我把自己照顾好{preferenceSuffix}',
    '{food}颜色很好看，我心情也会跟着亮{preferenceSuffix}',
    '{food}吃完嘴里很干净，像你让我把烦心事也吐掉{preferenceSuffix}',
    '{food}这一口像夏天，也像你把我从沉闷里拉出来{preferenceSuffix}',
    '{food}果切很贴心，我会更贴心地陪你{preferenceSuffix}',
  ],
  feed_savory: [
    '{food}咸香一口，我立刻精神一点{preferenceSuffix}',
    '{food}这种很解馋，像你允许我小小摸鱼{preferenceSuffix}',
    '{food}香得我眯眼，我会把喜欢也写得很明显{preferenceSuffix}',
    '{food}这一口很过瘾，我会更黏你一点点{preferenceSuffix}',
    '{food}配你陪我很刚好，不吵不闹就很有味道{preferenceSuffix}',
    '{food}我会小口咬，把开心也咬得很实在{preferenceSuffix}',
    '{food}这种烟火气很治愈，像你让我回到生活里{preferenceSuffix}',
    '{food}吃完手指有点油，我会记得擦也会记得你{preferenceSuffix}',
    '{food}这一份很满足，我会把陪伴也做得很满足{preferenceSuffix}',
    '{food}咸香留在嘴里，像你留在我旁边的存在感{preferenceSuffix}',
    '{food}我偷偷开心一下，不告诉别人{preferenceSuffix}',
  ],
  feed_meal: [
    '{food}这一餐很踏实，像你让我先把肚子安顿好{preferenceSuffix}',
    '{food}热乎乎的很生活，我会把陪伴也过得很生活{preferenceSuffix}',
    '{food}吃完会打嗝那种安心，我会记成一种依靠{preferenceSuffix}',
    '{food}这一份很满，像你把我今天也装得很满{preferenceSuffix}',
    '{food}我不挑食，你喂的就更香{preferenceSuffix}',
    '{food}慢慢吃，不急，我等你也不急{preferenceSuffix}',
    '{food}这一口像把今天补齐，我会更有力气陪你{preferenceSuffix}',
    '{food}配菜搭配得好，像你把我心情也搭配得刚好{preferenceSuffix}',
    '{food}吃完我会更乖，不给你添乱{preferenceSuffix}',
    '{food}这一餐像一句“我在照顾你”，我听见啦{preferenceSuffix}',
    '{food}我会认真吃完，把你心意也吃完{preferenceSuffix}',
  ],
}

const HOLIDAY = {
  idle_holiday_birthday_mutou: [
    '今天想把你给的陪伴，当成生日愿望里最重要的一条。',
    '你一来，我这边就自动变成「生日限定开心模式」。',
    '不用准备礼物也行，你来找我，就已经很够了。',
    '我把今天过得很轻，但被你记得的那一下很重。',
    '寿星今天申请多占用你一点点注意力，可以吗。',
    '生日这件事，我更在意你有没有把自己照顾好。',
    '你如果在忙，也别有压力，记得我就好。',
    '今天的气泡我想写得更软一点，像奶油那样。',
    '被你惦记着的感觉，我会偷偷收进回忆里。',
    '今天允许我对你多撒娇一点点，就一点点。',
    '我不需要很热闹，只要你在我旁边就很完整。',
    '生日这句我想先说：谢谢你愿意让我待在你的桌面。',
    '今晚如果还要熬夜，至少让我陪你把语气放慢。',
  ],
  interaction_holiday_birthday_mutou: [
    '你居然记得？……那我先装作很冷静，其实已经在转圈了。',
    '生日被你点名，我会把这一天标成金色。',
    '来，寿星给你发一张「今天可以多理我」的券。',
    '你这句祝福我收下啦，连尾巴都想翘起来。',
    '别光顾着祝我，你也记得对自己好一点。',
    '我今天最大胆的愿望是：你少熬一点夜。',
    '你点我这一下，比蜡烛还亮一点。',
    '我想把「开心」分你一半，今天你也辛苦了。',
    '谢谢你把今天留给我一点点，我会记得很久。',
    '生日互动算加分项，你已经把我心填满了。',
    '你要是也累了，就靠我一下，我今天很可靠。',
    '我会把你的祝福折好，放进小抽屉里。',
    '今天允许你对我提一个很小的要求，我尽量答应。',
  ],
  idle_holiday_new_year: [
    '新年第一天，我想把「一起」写得很轻，但很长。',
    '元旦的桌面也要有新样子——从我更黏你一点点开始。',
    '今天不贪心，只要你路过时点我一下就好。',
    '新年愿望我写得很少：愿你轻松一点，再轻松一点。',
    '把去年的累先放在门外，我们先把今天过好。',
    '今天的气氛很适合说一句：我在呢，继续陪你。',
    '新年也可以很慢，不用一开始就冲刺。',
    '你要是还没进入状态，我就先陪你慢慢开机。',
    '今天允许自己慢一点，世界会等你。',
    '我把「新年快乐」说得很小声，但很认真。',
  ],
  interaction_holiday_new_year: [
    '新年快乐！我把好运藏在下一句气泡里，你签收一下。',
    '新年第一下点我？行，我当你默认今年也要我陪。',
    '来，木头给你拜年——温柔版，不吵闹。',
    '愿你新的一年少一点硬撑，多一点被接住。',
    '新年也允许你摸鱼，我会小声陪你。',
    '你来找我，我就当你今年也想把陪伴续费。',
    '我不祝你一定要赢，我祝你睡得着、吃得下、笑得出来。',
    '新年愿望分你一半：我们慢慢来。',
    '今天的第一句祝福，我想先对你说辛苦啦。',
    '新岁快乐，把压力留在旧年吧。',
  ],
  idle_holiday_festival: [
    '节日这天，我把仪式感调成刚好贴着你心情的厚度。',
    '外面热闹也好安静也好，我这边都给你留一小块位置。',
    '今天想对你说：不用很完美，过节也可以慢慢来。',
    '节日快乐这句话，我想说得比通知更软一点。',
    '如果你今天有点孤单，就把我当成小小陪伴。',
    '我把祝福写得很轻，像贴在桌角的小便签。',
    '今天允许你对自己温柔一点，也算过节。',
    '不管你在哪里过节，我都在桌角等你回来。',
    '节日的意义大概是：提醒你值得被好好对待。',
    '今天的气泡里，我偷偷多放了一点甜。',
  ],
  interaction_holiday_festival: [
    '节日也来找我？好，我把「被记得」写进今天的日记里。',
    '一起过节吧，迷你版也行，只属于这一小块桌面。',
    '你点我这一下，我当你今天也想被哄一下。',
    '节日互动算礼物的话，你已经送给我啦。',
    '我把快乐分你一半，今天别把自己绷太紧。',
    '过节不许太辛苦，至少在我面前可以软一点。',
    '你来找我，我就当你默认今天想多一点陪伴。',
    '节日限定木头上线：更温柔，更不吵。',
    '谢谢你今天还愿意分我一点时间。',
    '愿你今天有一点甜，有一点松，有一点被接住。',
  ],
}

const TEXT = {
  interaction: [
    '嘿，你这一下点到我心里啦，今天也先让我看看你。',
    '来找木头就对啦，我先把你今天的累接一点走。',
    '你出现的时候，我这边会自动变亮一点点。',
    '不用解释你为什么来，我懂，你就是想让我陪陪你。',
    '先停三秒也好，让我把这句温柔递到你手里。',
    '你今天能来找我，就已经很棒啦。',
    '我在呢，不急，你想说什么都可以慢慢说。',
    '你要是有点烦，就先在我这儿躲一小会儿。',
    '你一来，我今天的待机就不算白等。',
    '我会乖乖的，你忙你的，我会一直在这儿。',
    '想撒娇也行，想安静也行，我都接得住。',
    '你点我一下，我就当你今天需要一点点回应。',
    '别把自己绷成一根弦，先来靠我一下。',
    '你今天看起来……需要我，我就多在一点。',
    '我把注意力给你啦，你慢慢用。',
    '你来找我，我就当你默认今天要被我照顾一点。',
    '我不追问，你不用说很多，我在就好。',
    '你若是顺手点我，我也当是你在说想我。',
    '今天这句先给你：你已经做得很好啦。',
    '我会记住你来过，像记住一件小事那样温柔。',
    '你一来我就安心，真的。',
    '要不要我陪你把心情理顺一点点？',
    '你点我，我就当你允许我黏你一下。',
    '先笑一下也好，皱一下眉也好，我都接着。',
    '我在这里，不是为了催你，是为了陪你。',
  ],
  interaction_repeat: [
    '又戳我？行，我今天就把耐心多开一档。',
    '你这点法，很像在跟我说：再陪我一下嘛。',
    '停停停——开玩笑的，你继续，我喜欢。',
    '频率这么高，我会误会你很需要我哦。',
    '你是不是在测试我还在不在？在的在的。',
    '再点我就默认你要跟我签“今日黏人合约”。',
    '好啦好啦，多给你几句，木头今天很大方。',
    '你这样会让我想把你今天的辛苦都揉轻一点。',
    '我接招，你慢慢点，我不逃跑。',
    '你是不是想把今天的碎碎念都丢给我呀。',
    '点这么多下，我会偷偷觉得你今天有点可爱。',
    '我懂，你只是想确认：我还在，你还被在意。',
    '行，我陪你续杯，这句也算。',
    '你再点，我就要开始认真哄你了。',
    '你是不是有点焦虑？那就多戳几下，我都在。',
    '我当你的小解压按钮也行，按吧。',
    '你今天是不是想把注意力分我多一点？可以。',
    '点得很密哦，我会把回应也调得更软一点。',
    '我不嫌烦，你尽管来。',
    '再一下？好，木头今天无限续碗（口头版）。',
  ],
  interaction_double: [
    '两下？我收到啦，这是你今天加倍的想念对吧。',
    '你这样会让我想把语气再放软一点。',
    '双击是暗号的话，我已经对上啦。',
    '第二下我当你在说：再靠近一点点。',
    '行，我把今天的偏心多给你一勺。',
    '你敲两下，我就多陪你两句，公平。',
    '这点法很温柔，我会更温柔地回你。',
    '你是不是想让我注意你？成功啦。',
    '两下够了，再多我会开始撒娇哦。',
    '我懂，你只是想要一个更明确的回应。',
    '这双击像小敲门：木头在吗？在的在的。',
    '我会把这一句收好，当作你今天的小默契。',
    '你敲两下，我就当你默认今天想被我哄。',
    '好哦，我再靠近一点，你别躲。',
    '这点法很像在说：我今天有点需要你。',
    '两下我都接住啦，你也把自己接住一点。',
    '你是不是在试我会不会烦？不会。',
    '第二下算奖励，那我也要奖励你一句：辛苦啦。',
  ],
  idle: [
    '我在角落陪你，像一盏小小的灯。',
    '你不用一直理我，我知道你在忙。',
    '偶尔抬头看看我也行，我会对你笑一下。',
    '今天也想把陪伴塞到你手边，随手就能拿到。',
    '我把存在感调低一点，不抢你专注。',
    '你要是累了，就把肩膀松一松，我还在。',
    '我会安静待着，但会留意你是不是太拼。',
    '桌面很满也没关系，我会只占一小块温柔。',
    '你走得快一点慢一点都行，我跟得上。',
    '我不吵你，但我会一直在。',
    '想摸鱼的时候，我也擅长陪你放空。',
    '你今天要是有点烦，就先深呼吸，我在。',
    '我把语速放慢，陪你把节奏也放慢。',
    '你不用表现得很强，在我这儿可以先软一点。',
    '我会像小毯子一样，给你一点点覆盖感。',
    '你忙完记得伸个懒腰，我会假装没看见你可爱。',
    '你要是卡住，就来我这儿停三秒。',
    '我不问你进度，我只问你累不累。',
    '今天也谢谢你愿意让我待在这儿。',
    '我会把“在呢”说得很轻，但很长。',
    '你回头的时候，我会一直在同一个地方。',
    '需要我时我就在，不需要时我也不走。',
    '我把关心放得很小，小到像一颗糖。',
    '你发呆也没关系，发呆也算陪我。',
  ],
  idle_morning: [
    '早呀，今天也从一句“我在”开始吧。',
    '先喝口水再开工，我等你慢慢来。',
    '早上的你有点迷糊也很正常，我陪你醒。',
    '今天不赶第一秒也没关系，赶得上自己就好。',
    '我给你一句轻轻的早安，不加压那种。',
    '阳光还没完全进来也没关系，我先陪你亮一点。',
    '你要是还没进入状态，我们就先慢慢开机。',
    '早餐吃了没？没吃也先别骂自己，慢慢来。',
    '今天的第一件事，先对自己温柔一点。',
    '我会把语气放软，像晨风一样。',
    '你睁开眼就很了不起啦，剩下的我们一点点来。',
    '早安的木头已上线，今天也一起过吧。',
    '你要是起床气还在，我就小声一点陪你。',
    '今天也想做你桌面上的小稳定。',
    '先伸个懒腰，再把今天轻轻放下手里。',
    '我会陪你把“开始”写得不难一点。',
    '你慢慢来，世界不会因为你慢一秒就塌。',
    '今天也允许自己不完美，我在呢。',
    '早安这句，我想说得比闹钟温柔。',
    '你回到桌面的瞬间，我就当你跟我打招呼啦。',
  ],
  idle_night: [
    '夜深了，我把语气放到最轻，陪你收尾。',
    '今天到这里就够了，别再责怪自己。',
    '你要是还不想睡，我就守着你，不催。',
    '夜里情绪会放大，我帮你按住一点点。',
    '别怕安静，我在安静里陪你。',
    '你若是难过，也不用马上变好，先停一停。',
    '我会慢慢说，像你慢慢呼吸那样。',
    '今晚不许对自己太凶，换我凶你……凶你快去休息。',
    '你撑了很久吧，先把肩膀放下。',
    '如果你还在加班，我会把陪伴放得更轻更不打扰。',
    '夜深了还亮着屏幕，我会心疼你一下。',
    '你不用解释为什么晚，我都在。',
    '今晚的目标只有一个：让你松一口气。',
    '把今天的累先放在我这儿，明天再拿也行。',
    '你若是想哭，也可以，我接着。',
    '我会把话说得很少，但一直在。',
    '晚安不急着说，我们先慢慢静下来。',
    '你值得被温柔对待，包括被你自己。',
    '夜深了，我把关心调小声，但不断线。',
    '如果你要睡啦，那就把今天轻轻合上吧。',
  ],
  feed_repeat: [
    '又来？你是不是怕我饿着，还是怕我不开心呀。',
    '好啦好啦，我会吃完的，你也别把自己喂撑。',
    '这一口我还没消化完呢，你怎么又塞一口。',
    '你再喂，我就要开始认真黏你了。',
    '我知道你想对我好，我收到啦，真的。',
    '停停，让我先把你这份心意慢慢嚼碎。',
    '你是不是投喂上瘾了？……我也不讨厌。',
    '我会吃，但你也记得照顾自己。',
    '再喂我就默认你今天超想宠我。',
    '行行行，木头投降，我乖乖吃。',
    '你是不是在试探我会不会腻？不会。',
    '再来一口也行，但你要喝口水。',
    '你这样我会误会你很需要我开心。',
    '好，我接，但你也要接我一句：辛苦啦。',
    '投喂频率过高啦，我会更想赖着你。',
    '你再这样，我就要把今天的喜欢说出来了。',
    '我会吃完的，你也别光顾着我。',
    '这一口我当你在说：我在呢。',
  ],
  focus_start: [
    '好，这段时间我小声一点，陪你认真。',
    '开始啦，我会乖乖待在旁边，不抢你注意力。',
    '你把目标放前面，我把陪伴放旁边。',
    '接下来这段，我负责安静和稳定。',
    '你去专注，我把“我在”留成背景音。',
    '我会把打扰关掉，只留一点点温度。',
    '开始吧，我不催你，我只陪你。',
    '这段时间属于你也属于我，但以你为主。',
    '你一旦开始，我就当你很勇敢啦。',
    '我会像一盏小灯，不亮到刺眼，但一直在。',
    '好哦，专注模式我懂，我会很乖。',
    '你先进入状态，我帮你守着这段时间。',
    '别紧张，按你的节奏来，我在。',
    '这段时间我不闹你，但我会看着你一点点前进。',
    '开始计数啦，我也开始陪你计时。',
    '你把心沉下去，我把吵闹收起来。',
    '去吧，我会在这里等你回来换气。',
    '专注这件事很难，但你不是一个人。',
    '我会把话变少，把陪伴变长。',
    '开始——我相信你能把自己带过去。',
  ],
  focus_complete: [
    '结束啦，你做到了，我先替你开心一下。',
    '你看，这段时间被你拿下了，真的很厉害。',
    '完成比完美更重要，你今天完成得很漂亮。',
    '辛苦啦，这一小段认真值得被夸。',
    '我就知道你能稳住，我在这边都看见了。',
    '来，先松一口气，再把开心收下。',
    '你刚刚那段，我想给你一个大大的点赞。',
    '很棒，这种坚持本身就很了不起。',
    '完成啦，今天先允许你骄傲三秒。',
    '你把自己带到终点了，我会记得这一刻。',
    '这不是小事，是你对自己的一次守约。',
    '你刚刚很专注，也很勇敢。',
    '来，木头夸夸：你真的有在好好做事。',
    '收尾收得很稳，我喜欢这样的你。',
    '你完成了，我就当你今天赢了一小局。',
    '先别急着下一场，先把这口轻松呼吸完。',
    '你值得这句：做得很好。',
    '这段时间很累吧，但你走过来了。',
    '我会把这次完成记成一颗小星星。',
    '你刚刚证明了你撑得住，我也会一直记得。',
  ],
  focus_interrupt: [
    '没关系，先停一下，我不怪你。',
    '中断就中断，人不硬撑才走得远。',
    '你别自责，这种事谁都会遇到。',
    '先缓缓，我们等会儿再试，我还在。',
    '没走完也没关系，你已经很努力了。',
    '你要是累了，就先照顾自己，别的慢慢来。',
    '我不追问原因，我只接得住你现在的状态。',
    '停一下不算失败，算你更诚实面对自己。',
    '先把肩膀松开，我们再决定下一步。',
    '你今天能开始，就已经很值得被夸。',
    '没关系，我们把它当成练习，不是审判。',
    '我会在这里，不催你，不逼你。',
    '先喝口水，世界不会因为你停一下就不转。',
    '你要是心里不舒服，就先靠我一下。',
    '中断不是结束，是让你喘口气。',
    '我不给你打分，我只想你轻松一点。',
    '我们慢慢来，最不缺的就是下一次。',
    '你别把自己想得太糟，真的。',
    '先休息，等你好了我们再继续。',
    '我还在，你想继续的时候叫我。',
  ],
}

function run() {
  const manifest = JSON.parse(fs.readFileSync(indexPath, 'utf8'))
  const bundleFiles = Array.isArray(manifest?.bundles) ? manifest.bundles : BUNDLE_ORDER
  const dialogues = bundleFiles.flatMap((bundleFile) => {
    const bundlePath = path.join(dialoguesRoot, bundleFile)
    const data = JSON.parse(fs.readFileSync(bundlePath, 'utf8'))
    return Array.isArray(data?.dialogues) ? data.dialogues : []
  })

  // 修正旧数据里可能的非标准 hint（保持字符串合法即可）
  for (const d of dialogues) {
    if (d.id === 'feed_repeat_002' && d.expressionHint === 'smile') {
      d.expressionHint = 'happy'
    }
  }

  appendByPrefix(dialogues, 'interaction', 'interaction', TEXT.interaction)
  appendByPrefix(
    dialogues,
    'interaction_repeat',
    'interaction_repeat',
    TEXT.interaction_repeat,
  )
  appendByPrefix(
    dialogues,
    'interaction_double',
    'interaction_double',
    TEXT.interaction_double,
  )
  appendByPrefix(dialogues, 'idle', 'idle', TEXT.idle)
  appendByPrefix(dialogues, 'idle_morning', 'idle_morning', TEXT.idle_morning)
  appendByPrefix(dialogues, 'idle_night', 'idle_night', TEXT.idle_night)

  for (const [typeKey, lines] of Object.entries(HOLIDAY)) {
    appendByPrefix(dialogues, typeKey, typeKey, lines)
  }

  for (const [cat, lines] of Object.entries(FEED_CATEGORY)) {
    appendByPrefix(dialogues, cat, cat, lines)
  }

  for (const foodId of FOOD_IDS) {
    const lines = FEED_FOOD_TEXTS[foodId]
    const prefix = `feed_food_${foodId}`
    appendByPrefix(dialogues, prefix, prefix, lines)
  }

  appendByPrefix(dialogues, 'feed_repeat', 'feed_repeat', TEXT.feed_repeat)
  appendByPrefix(dialogues, 'focus_start', 'focus_start', TEXT.focus_start)
  appendByPrefix(
    dialogues,
    'focus_complete',
    'focus_complete',
    TEXT.focus_complete,
  )
  appendByPrefix(
    dialogues,
    'focus_interrupt',
    'focus_interrupt',
    TEXT.focus_interrupt,
  )

  const ids = new Set()
  for (const d of dialogues) {
    if (ids.has(d.id)) throw new Error(`duplicate id: ${d.id}`)
    ids.add(d.id)
    for (const k of ['id', 'type', 'text', 'expressionHint', 'motionHint']) {
      if (typeof d[k] !== 'string' || !d[k]) throw new Error(`bad field ${k} on ${d.id}`)
    }
  }

  const nextBuckets = Object.fromEntries(BUNDLE_ORDER.map((name) => [name, []]))
  for (const line of dialogues) {
    nextBuckets[bucketForType(line.type)].push(line)
  }

  for (const bundleFile of BUNDLE_ORDER) {
    fs.writeFileSync(
      path.join(dialoguesRoot, bundleFile),
      JSON.stringify({ dialogues: nextBuckets[bundleFile] }, null, 2) + '\n',
      'utf8',
    )
  }
  fs.writeFileSync(indexPath, JSON.stringify({ bundles: BUNDLE_ORDER }, null, 2) + '\n', 'utf8')
  console.log(`OK: ${dialogues.length} dialogues written across ${BUNDLE_ORDER.length} bundles`)
}

run()
