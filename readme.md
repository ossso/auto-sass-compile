# sass watch | 监听sass文件自动编译
基于dart-sass，对sass文件的第一行注释进行编译，加入了PostCSS；  
支持compressed（压缩）和expanded（展开）两种模式。 
更新：2020年03月，Node版本12.15.0   

## 使用方法
0.安装；  
```bash
npm install
```
1.配置监听目录：  
在当前目录中创建目录`rule`  
在`./rule/`目录下编写监听规则（json文件）  
监听规则：  
Windows:  
```json
[
    "D://workspace//sass-watch//example"
]
```
Unix:  
```json
[
    "/workspace/sass-watch/example"
]
```
2.在监听目录中保存`.sass`/`.scss`文件即可编译

## sass文件注释方法
压缩输出
```
// compileCompressed: style.css
```
展开输出
```
// compileExpanded: style.css
```

## 命令行后台运行
基于forever
```bash
npm install -g forever
forever start index.js
```

## 注意事项
windows环境下，监听规则中的路径需要将`\`转换为`//`  
基于utf8编码，且只监听第一行注释符合规则的sass文件  
