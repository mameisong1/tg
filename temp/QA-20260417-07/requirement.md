天宫（台桌无关）自动关灯脚本生成
- 已实现：天宫国际当前实现了同步台桌状态时，自动关闭空闲台桌周边的灯。
- 脚本功能：还有一些灯是台桌无关的，也要在指定的时间内实现自动关灯。
- 脚本运行（生产环境）：在生产环境的容器内运行, 目录/app/tgservice/scripts
- 脚本运行（测试环境）：/TG/tgservice/scripts
- 关灯对象：从DB查询出以下需要关灯的开关数据,发出关灯指令。
select distinct A.开关ID, A.开关序号
from
设备开关表 A left join 台桌设备关系表 B on lower(A.开关标签)=lower(B.开关标签) and lower(A.开关序号)=lower(B.开关序号)
where B.台桌名 is null
 and 当前时间 between A.自动关灯开始 and A.自动关灯结束
- 关灯指令相关配置：由于本脚本是运行在容器内，因此可以直接读取tgservice/.config文件，获取相关配置。
- 注意1：脚本也受DB.智能省电-自动 开关的控制。脚本启动时检查db的开关，如果开关关闭则直接退出。