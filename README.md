# 智淀导航

功能介绍：

 智淀导航(ZdinNav)：网页书签存放的工具，将自己的全部书签，私有化部署到自己的：服务器、软路由、Nas、设备，实现数据保密，多端同步共享同一份数据。

1. 解决多浏览器与不同设备之间书签不能共享和统一管理的问题，并支持多账号不同数据的隔离访问。
2. 解决当你记录有价值的网页后，时隔多年需要翻看并解决当下需要解决的问题时，被遗忘于角落，不能再成百上千的书签里快速找到，导致你不断积累重复的书签，在堆积如山的书签中彷徨与烦恼。

知识的积累不在于你存放了多少有价值的数据，更在于当你需要使用你有价值数据的时候，能够快速翻阅并解决问题。毕竟你也不想在非在数字废墟中考古，这折磨人的事你懂滴。

| 智淀导航(ZdinNav) 获取地址： |
| ------------------------------------------------------------ |
| docker hub：[https://hub.docker.com/r/tkme/zdinnav](https://hub.docker.com/r/tkme/zdinnav) |
| [夸克网盘](https://pan.quark.cn/s/fa5e6213e013) 提取码：cbmE |
| [阿里云盘](https://www.alipan.com/s/5N7LrH7i1jQ) 提取码：rt20  阿里云限制分享，只能压缩exe上传，下载后直接点击exe即可解压为docker安装包 |
| [百度网盘](https://pan.baidu.com/s/19q8KaSAfJ0zYQey5CGXnLQ?pwd=jw3z) 提取码：jw3z |

效果图：
| 电脑端显示效果： |
| --------------- |
| <img src="preview%20image/pc登录预览.png" alt="pc登录预览" style="max-width:1000px;" /> |
| <img src="preview%20image/pc注册预览.png" alt="pc注册预览" style="max-width:1000px;" /> |
| <img src="preview%20image/pc首页预览.png" alt="pc首页预览" style="max-width:1000px;" /> |
| <img src="preview%20image/pc仓库共享书签查找.png" alt="pc仓库共享书签查找" style="max-width:1000px;" /> |


| 移动端显示效果： | |
| ---- | ---- |
| <img src="preview%20image/手机登录预览.png" alt="手机登录预览" style="max-width:300px;" /> | <img src="preview%20image/手机注册预览.png" alt="手机注册预览" style="max-width:300px;" /> |
| <img src="preview%20image/手机首页预览.png" alt="手机首页预览" style="max-width:300px;" /> | <img src="preview%20image/手机仓库共享书签查找.png" alt="手机仓库共享书签查找" style="max-width:300px;" /> |

安装教程：

使用docker安装：

`docker run -d --name zdinnav -p 9200:9200 tkme/zdinnav:1.0.0`



使用 docker compose安装(推荐使用这个)：

新建docker-compose.yaml文件，然后将下面的代码拷贝到该文件，在该文件下

执行命令：`docker-compose up -d`

```
services:
  zdinnav:
    image: tkme/zdinnav:1.0.0
    container_name: zdinnav
    restart: unless-stopped
    ports:
      - "9200:9200"
    networks:
      - zdinnavnet
    environment:
      - TZ=Asia/Shanghai 
    volumes:
      # 系统配置文件(系统自动生成，可以自定义数据库类型)
      - ./zdinnav/configuration:/app/configuration
      # SQLite数据存放(如果配置其它数据库，此文件不会生成)
      - ./zdinnav/database:/app/database
      # 日志记录
      - ./zdinnav/logs:/app/Logs
networks:
  zdinnavnet:
      driver: bridge
volumes:
  fonts_volume:
```

运行后，访问：http://IP地址:9200 

超级管理员账号：zdinnav

超级管理员密码：pwd123

docker-compose.yaml文件已经放到：docker-compose下面了。



如果无法访问hub.docker，可以下载离线安装包(下面使用zdinnav_linux-amd64-1.0.0.tar示例，离线安装包文件格式：zdinnav_版本号)：

执行命令(在tar文件路径下执行)：`docker load -i ./zdinnav_linux-amd64-1.0.0.tar`

然后执行：上面的安装命令，命令里面出现的 1.0.0(版本号)改成(tar的版本号)：linux-amd64-1.0.0 执行命令即可。




其他自定义配置在 configuration路径下 zdinNavSettings.json文件(该文件不存在会默认生成，需要自定义的时候，可以自己修改)

数据库配置：

dbType数据库类型：Sqlite、PostgreSQL、MySql、SqlServer、Oracle等，数据库底层访问使用SqlSugar，更多数据库支持可以查看该官方文档。

connectionString：不同的dbType数据库类型，链接字符串不一样，根据你的实际情况修改。默认SQLite数据存数据库



对外接口配置：

swaggerUI：swagger Api接口服务页面查看(默认关闭)

cors：对外暴露接口调用，为了安全默认关闭(如需第三方Api调用可以开启)。

