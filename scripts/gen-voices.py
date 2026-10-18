import asyncio
import os

import edge_tts

OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'audio', 'voices')
VOICE = 'zh-CN-YunxiNeural'
ITEMS = {
    'ming_line': ('列队！', 'zh-CN-YunxiNeural', '-2%'),
    'qing_array': ('列阵！', 'zh-CN-YunxiNeural', '-4%'),
    'cavalry_mount': ('上马！', 'zh-CN-YunxiNeural', '+8%'),
    'navy_sail': ('扬帆！', 'zh-CN-YunxiNeural', '+4%'),
    'japan_dress': ('整列！', 'ja-JP-KeitaNeural', '-2%'),
    'joseon_line': ('정렬!', 'ko-KR-InJoonNeural', '+2%'),
    'mongol_line': ('Жагсаарай!', 'mn-MN-BataaNeural', '-2%'),
    'voc_line': ('In formatie!', 'nl-NL-MaartenNeural', '+2%'),
    'russia_line': ('Стройся!', 'ru-RU-DmitryNeural', '-2%'),
    'default_assemble': ('集合！', 'zh-CN-YunxiNeural', '+0%'),
    'advance': ('前进！', 'zh-CN-YunxiNeural', '+6%'),
}


async def main():
    os.makedirs(OUT, exist_ok=True)
    for name, (text, voice, rate) in ITEMS.items():
        communicate = edge_tts.Communicate(text, voice, rate=rate, volume='+10%')
        await communicate.save(os.path.join(OUT, f'{name}.mp3'))
        print(name, voice)


asyncio.run(main())
