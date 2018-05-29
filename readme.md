# sass watch
基于node sass，对sass文件的第一行注释进行编译，加入了PostCSS，目前只做了compressed（压缩）和expanded（展开）两种模式。  
支持.sass和.scss后缀。  
粗糙插件，仅供两种模式的快速编译。

## 使用方法
0.安装环境；  
```bash
# 安装过forever可以忽略
npm install -g forever
npm install
```
1.运行start.bat；  
2.在rule目录下写入规则json文件，支持对象或数组；  
规则写法，路径为绝对路径：  
```json
{
    "path": "E://workspace//sass-watch//example"
}
```
```json
[
    {
        "path": "E://workspace//sass-watch//example"
    }
]
```
3.对应sass文件保存后会进行编译；  
4.删除rule目录下的json文件，自动取消监听；  

## sass文件注释方法
基于Atom的Sass Autocompile注释方法  
压缩输出
```
// compileCompressed: style.css
```
展开输出
```
// compileExpanded: style.css
```

## 注意事项
windows环境下，监听规则中的路径需要将```\```转换为```//```  
基于utf8编码，且只监听第一行注释符合规则的sass文件  
