# 虚拟书库

更新日期：2026-09-06。入口 `/virtual-library`，需要登录。

## 当前场景

原创学院哥特式圆厅保留双层书墙、上层回廊、螺旋楼梯、尖拱窗、封闭木质穹顶和月夜外景。入口、中央马蹄形接待台、对面的壁炉与画作共轴。中央区域没有独立阅读桌、椅子或内圈书架，也没有穿过上层书架的低横梁。吊灯链条按实际顶棚高度计算，并通过安装盘连接顶棚。

接待台上为黄铜底座、蓝色天球、子午环和目录铭牌组成的查询装置。壁炉采用有边界的体积光线步进火焰、炭火和木柴，火焰位于炉口内部与铁栅后方；不再使用面向镜头的火焰贴片。

左侧禁书档案室和右侧馆长办公室为独立、按需创建的房间。装饰与建筑使用原创构图，不把电影参考图打包为应用纹理。

## 交互

- 空闲时拖拽环绕，滚轮缩放圆厅；书架悬停有轮廓，点击后相机正对书架并保留选中框。
- 主厅每本真实目录书仅对应一个模型，不靠重复书名填满空架。检查书籍时拉出原模型；拖拽旋转、滚轮缩放、短点击进入真实阅读器，关闭后恢复上架位置。
- 点击天球打开屏幕居中的搜索框并聚焦；输入后显示匹配数量和结果，结果链接进入阅读器，Escape 或遮罩关闭。
- 搜索使用当前已授权并加载的目录，匹配标题、作者、系列、格式和标签；执行 NFKC、大小写归一化和空白分词，多词同时匹配。它不搜索书籍正文，也不调用外部搜索服务。
- 目录请求失败提供重试。独立房间可进入并返回主厅。

## 代码入口

| 文件（相对 apps/web/src/pages/） | 职责 |
|---|---|
| `VirtualLibraryExperience.tsx` | 目录请求、页面状态、场景与查询弹层组合 |
| `VirtualLibrarySearch.tsx` | 检索、空结果与阅读链接 |
| `virtual-library-scene.ts` | 场景交互与生命周期 |
| `virtual-library-model/scene/buildLibrary.ts` | 主厅组装 |
| `virtual-library-model/scene/scholasticArchitecture.ts` | 木质拱顶与建筑细节 |
| `virtual-library-model/scene/catalogTerminal.ts` | 天球查询装置（文件名沿用 terminal） |
| `virtual-library-model/scene/fireplaceFire.ts` | 火焰体积材质、炭火及动画 |
| `virtual-library-rooms.ts` | 独立房间与顶棚结构 |

静态几何批处理降低绘制调用；更新回调保留动态材质动画。测试覆盖结构净空、吊灯连接、火焰包围盒、炭火接触、搜索和书籍交互基础逻辑。

## 资源与许可

资源位于 `apps/web/public/assets/virtual-library/`。NASA 地球图、公共领域画作、项目生成图像与 Poly Haven 模型各有相邻 `NOTICE.md`，保留作者及原许可。资源在本地打包，场景不依赖运行时第三方图片下载。旧火焰贴片保留来源说明，但当前炉火不使用它。

## 验证记录

[迭代与截图](../design/qa/gothic-library/README.md)保存历次方案；当前截图为 `orb-fire-front.jpg`、`orb-fire-oblique.jpg`、`orb-centered-search.jpg`。较早的桌椅和电脑截图仅为历史记录。桌面现场已验证天球点击、查询、无结果、阅读跳转、房间切换和书籍检查；旧记录中的移动视口覆盖未成功，不据此声称移动端视觉验收完成。最新自动化结果见[实施状态](implementation-status.md)。
