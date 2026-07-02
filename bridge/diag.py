"""打包诊断 / packaging diagnostic: 验证 MetaTrader5 能否在打包后导入。"""
import sys

print("frozen:", getattr(sys, "frozen", False))
print("sys.path[0]:", sys.path[0])
try:
    import MetaTrader5 as mt5
    print("MetaTrader5 import: OK, version attr:", hasattr(mt5, "initialize"))
except Exception as e:
    print("MetaTrader5 import FAILED:", repr(e))
try:
    import psutil
    print("psutil import: OK")
except Exception as e:
    print("psutil import FAILED:", repr(e))
input("press Enter to exit...")
