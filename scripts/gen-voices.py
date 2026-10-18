import asyncio
import os

import edge_tts

OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'audio', 'voices')
VOICE = 'zh-CN-YunxiNeural'
ITEMS = {
    'ming_line': '列队！',
    'qing_array': '列阵！',
    'cavalry_mount': '上马！',
    'navy_sail': '扬帆！',
    'japan_dress': '整列！',
    'default_assemble': '集合！',
    'advance': '前进！',
}


async def main():
    os.makedirs(OUT, exist_ok=True)
    for name, text in ITEMS.items():
        communicate = edge_tts.Communicate(text, VOICE, rate='+5%', volume='+10%')
        await communicate.save(os.path.join(OUT, f'{name}.mp3'))
        print(name)


asyncio.run(main())
