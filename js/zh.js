/* 中文 for TT Cookie Chase: the words on the page, the toasts and banners, the ? panel (Kit.lang, from kit/lang.js),
   and the comic words drawn on canvases (HEE HEE!, BONK!, STOP!, through Kit.lang.t in js/art.js).
   The kids' names, the raccoons' names and the game's name stay in English on purpose. */
(function () {
  const L = Kit.lang;
  L.keep(['TEDDY', 'TOMMY', 'Teddy', 'Tommy', 'BANDIT', 'SNEAKY', 'WOBBLES', 'PIP', CC.TITLE, 'Claude Code', 'Esc']);

  const MAZE = {
    'SUNNY GARDEN': '阳光花园', 'APPLE ORCHARD': '苹果园', 'CARROT ROWS': '胡萝卜地', 'PUMPKIN PATCH': '南瓜田',
    'STRAWBERRY FIELD': '草莓田', 'SUNFLOWER LANE': '向日葵小路', 'PICNIC PARK': '野餐公园', 'MOONLIGHT GARDEN': '月光花园',
  };
  const TREAT = { 'ICE CREAM': '冰淇淋', WATER: '水', 'JUICE BOX': '果汁', COOKIE: '饼干', WATERMELON: '西瓜', BANANA: '香蕉' };
  const KEY = { T: 'T', Enter: '回车' };
  const names = Object.keys(MAZE).join('|');

  L.add(MAZE);
  L.add({
    // title screen
    "Teddy & Tommy's cookie maze": 'Teddy 和 Tommy 的饼干迷宫',
    '🍪 1 PLAYER': '🍪 单人', '8 garden mazes': '8 个花园迷宫',
    '👫 2 PLAYERS': '👫 双人', 'Teddy and Tommy together': 'Teddy 和 Tommy 一起玩',
    'slow, sleepy raccoons': '浣熊慢吞吞', 'for big kids': '大孩子玩', Difficulty: '难度',
    '🎮 D-PAD: OFF': '🎮 方向键：关', '🎮 D-PAD: ON': '🎮 方向键：开',
    'PLAYER 1': '玩家 1', 'PLAYER 2': '玩家 2',
    "Swipe anywhere to steer, and tap your brother's face to call him in. Two players on one iPad: the left half steers player 1, the right half player 2.":
      '在屏幕上随便滑一下就能转弯，点兄弟的头像叫他来帮忙。两个人玩一台平板：左半边是玩家 1，右半边是玩家 2。',
    'follows you': '一直跟着你', 'runs to where you are going': '抢先跑到你前面', 'goes any old way': '东跑西跑',
    'is shy and runs off when he gets close': '很害羞，一靠近就跑开',
    'LOADING…': '加载中…', '↻ Turn sideways for a bigger garden!': '↻ 把手机横过来，花园更大！',
    // pick your hero and the maze
    'PICK YOUR HERO': '选择你的英雄', 'TEAM UP!': '组队！', '+ buddy': '+ 帮手',
    '◀ BACK': '◀ 返回', "LET'S GO!": '出发！',
    'hero ·': '选英雄 ·', 'maze ·': '选迷宫 ·', 'go ·': '出发 ·', back: '返回',
    // HUD and buttons (their tooltips too)
    'Pause (P)': '暂停 (P)', 'Sound (M)': '声音 (M)',
    // toasts
    '🍪 5 COOKIES LEFT!': '🍪 还剩 5 块饼干！', '🥛 MILK! THE RACCOONS ARE SLEEPY!': '🥛 喝牛奶啦！浣熊们困了！',
    'TICKLE TICKLE!': '挠痒痒！',
    // banners, pause and results
    'MAZE CLEAR!': '迷宫过关！', 'OOPS!': '哎呀！', 'Out of hearts': '红心用完了', 'YOU DID IT!': '你做到啦！',
    'P · Esc · Space to resume · Q for the menu · M sound': 'P · Esc · 空格 继续 · Q 回菜单 · M 声音',
    'NEXT MAZE ▶': '下一个迷宫 ▶', '↻ TRY AGAIN': '↻ 再试一次', '↻ PLAY AGAIN': '↻ 再玩一次', '⭐ NEW BEST!': '⭐ 新纪录！',
    'Every maze cleared. High five! ✋': '所有迷宫都过关啦，击个掌！✋',
    'Enter next maze · Esc menu': '回车 下一个迷宫 · Esc 菜单', 'Enter try again · Esc menu': '回车 再试一次 · Esc 菜单',
    'Enter play again · Esc menu': '回车 再玩一次 · Esc 菜单',
    // comic words drawn on the canvas
    'HEE HEE!': '嘻嘻！', 'HELP!': '救命！', 'BONK!': '咚！', 'STOP!': '停！', 'MUNCH!': '吧唧！', 'HIGH FIVE!': '击掌！', 'SWISH!': '唰！',
    // the ? panel (js/keys.js)
    'In 1 player both sets of keys work. Press a way early and he turns at the next corner.': '单人时两套按键都能用。提前按方向，到下一个路口就会转弯。',
    "Swipe anywhere to steer (two players: left half and right half), and tap your brother's face to call him.":
      '在屏幕上随便滑一下就能转弯（两个人玩：左半边和右半边），点兄弟的头像叫他来帮忙。',
  });

  const maze = (s) => s.replace(new RegExp(`^(${names})`), (m) => MAZE[m]);
  L.rule(new RegExp(`^(${names})( ✓)?$`), (m) => maze(m));
  L.rule(/^MAZE (\d+)$/, '迷宫 $1');
  L.rule(new RegExp(`^MAZE (\\d+) · (${names})$`), (m, n, name) => `迷宫 ${n} · ${MAZE[name]}`);
  L.rule(/^SCORE ([\d,]+)$/, '得分 $1');
  L.rule(/^(.+) ate the last cookie!$/, '$1 吃掉了最后一块饼干！');
  L.rule(/^Out of hearts in maze (\d+)\. Have another go!$/, '迷宫 $1 的红心用完了，再来一次吧！');
  L.rule(/^(\S+) YUM! \+(\d+)$/, '$1 好吃！+$2');
  L.rule(/^(.+) IS GETTING TICKLED! HELP HIM!$/, '$1 被挠痒痒啦！快去救他！');
  L.rule(/^✋ (.+) SAVED (.+)!$/, '✋ $1 救了 $2！');
  L.rule(/^(.+) SAYS: GO GO GO!$/, '$1 说：冲冲冲！');
  L.rule(/^(\S+) (ICE CREAM|WATER|JUICE BOX|COOKIE|WATERMELON|BANANA) FROM (.+)!$/, (m, e, item, who) => `${e} ${who} 送来的${TREAT[item]}！`);
  L.rule(/^(.+) MUNCHED (\d+) COOKIES?!$/, '$1 一口气吃了 $2 块饼干！');
  L.rule(/^Call (\S+)(?: \((T|Enter)\))?$/, (m, who, k) => `叫 ${who} 来帮忙${k ? ` (${KEY[k]})` : ''}`);
  L.rule(/^Oops, something went wrong: (.*)$/, '哎呀，出错了：$1');
})();
