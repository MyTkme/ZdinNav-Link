"use strict";
"require view";
"require uci";
"require form";
"require ui";
"require fs";
"require dom";
"require poll";

return view.extend({
  _configData: {},
  _lineIndex: 0,
  _container: null,
  /**
   * 消息提示
   * @param {string} msg 消息内容
   * @param {string} type 类型：info、success、warning、error
   */
  notification: function (msg, type) {
    // 关闭其它消息
    $(".zdinnav-notification").remove();
    // 抛出异常提示
    ui.addNotification(null, msg, type, "zdinnav-notification");
    // 滚动顶部
    $("html, body, .main").animate({ scrollTop: 0 }, 600);
  },
  /**
   * 非空校验正则表达式 - 不能是空字符串、换行
   * @param {string} value
   * @returns true=不为空
   */
  validateNonEmpty: function (value) {
    return new RegExp("^(?!\\s*$).+").test(value);
  },
  /**
   * 表单数据正则校验
   * @param {string} type 校验类型
   * @param {string} value 校验内容
   * @returns 返回错误信息，true表示校验通过
   */
  regexValidation: function (type, value) {
    // 不同类型字段校验
    switch (type) {
      case "port":
        if (!this.validateNonEmpty(value)) return _("Port cannot be empty.");
        // 端口号验证:端口号范围：0-65535
        if (
          !new RegExp(
            "^([0-9]{1,4}|[1-5][0-9]{4}|6[0-4][0-9]{3}|65[0-4][0-9]{2}|655[0-2][0-9]|6553[0-5])$"
          ).test(value)
        )
          return _("Port format is incorrect.");
        break;
      case "config_path":
        if (!this.validateNonEmpty(value))
          return _("Configuration file path cannot be empty.");
        break;
      case "database_type":
        if (!this.validateNonEmpty(value))
          return _("Data type cannot be empty.");
        break;
      case "connection_settings":
        if (!this.validateNonEmpty(value))
          return _("Database connection string cannot be empty.");
        break;
      case "administrator_account":
        if (!this.validateNonEmpty(value))
          return _("Administrator account cannot be empty.");
        //账号校验: 2-20位，只能是字母、数字，不区分大小写
        if (!new RegExp("^[a-zA-Z0-9]{2,20}$", "i").test(value))
          return _(
            "Account must be 2-20 characters, only letters and numbers are allowed."
          );
        break;
      case "administrator_password":
        if (!this.validateNonEmpty(value))
          return _("Password cannot be empty.");
        // 6-12位，只能是字母、数字、符号，不区分大小写
        if (
          !new RegExp(
            "^[a-zA-Z0-9!@#$%^&*()_+\\-=$${};':\"\\\\|,.<>\\/?]{6,12}$",
            "i"
          ).test(value)
        )
          return _(
            "Password must be 6-12 characters, only letters, numbers, and symbols are allowed."
          );
        break;
      case "enable_offline_installation":
        // 离线安装 类型不做校验
        return true;
      default:
        return _("No corresponding validation %s type found.").format(type);
    }
    return true;
  },
  /**
   *
   * @param {string} containerId 显示区域div
   * @param {string[]} dataArray 显示内容
   * @param {boolean[]} state:状态标记：processing=处理中、finish=完成、error=异常
   * @returns
   */
  progressOutput: function (containerId, dataArray, state) {
    return new Promise(function (resolve) {
      const container = document.getElementById(containerId);
      if (
        !container ||
        !containerId ||
        !Array.isArray(dataArray) ||
        dataArray.length <= 0
      ) {
        resolve();
        return;
      }
      let index = 0;
      let lastRenderTime = performance.now();

      function renderNextLine(timestamp) {
        // 计算时间间隔，控制输出节奏
        const timeElapsed = timestamp - lastRenderTime;

        if (index >= dataArray.length) {
          //如果全部输出完成 或者 异常，就移除 loading显示
          if (state == "finish") {
            const lastChild = container.lastChild;
            lastChild.removeAttribute("style");
            lastChild.removeAttribute("class");
            lastChild.classList.add("zdinnav-success-progress");
            lastChild.textContent = _("✅ Completed");
          } else if (state == "error") {
            const lastChild = container.lastChild;
            lastChild.removeAttribute("style");
            lastChild.removeAttribute("class");
            lastChild.classList.add("zdinnav-error-progress");
            lastChild.textContent = _("❌ Failed");
          }
          // 本次内容输出完毕
          resolve();
          return;
        }
        // 每100ms输出一行，保持流畅节奏
        if (timeElapsed >= 100) {
          // 创建新行
          const div = document.createElement("li");
          div.style.cssText = "margin-left:30px;list-style-type:decimal;";
          div.textContent = dataArray[index];
          // 在loading显示上添加内容，既：倒数第二行 添加显示内容
          container.insertBefore(div, container.lastChild);
          // 立即滚动到最新位置
          container.scrollTop = container.scrollHeight;
          index++;
          lastRenderTime = timestamp;
        }
        // 继续渲染下一行
        requestAnimationFrame(renderNextLine);
      }
      // 启动渲染循环
      requestAnimationFrame(renderNextLine);
    });
  },
  /**
   * 轮询实时获取安装、升级进度信息
   */
  pollProgress: function () {
    const self = this;
    poll.add(function () {
      return new Promise(function (resolve, reject) {
        fs.exec("/usr/libexec/zdinnav", [
          "get_read_log",
          self._lineIndex + "",
        ]).then((o) => {
          if (Number(o.code) != 0) {
            poll.stop();
            self.notification(JSON.stringify(o), "error");
            reject();
            return;
          }
          const info = JSON.parse(o.stdout);
          if (info.lines.length <= 0 || info.last_line <= 0) {
            resolve();
            return;
          }
          if (info.state == "finish") {
            poll.stop();
            $("#id_btn_progress")
              .text(_("Finish"))
              .attr("data-finish", "finish");
          } else if (info.state == "error") {
            poll.stop();
          } else {
            // 保留显示行，防止数据不完整：每次加载最后一条不显示，直到完毕的时候显示(加载有预留都显示前面一行)
            info.lines.pop();
          }
          // 更新获取下标
          self._lineIndex = info.last_line;
          // 滚动加载数据
          self
            .progressOutput("id_progress_information", info.lines, info.state)
            .then(resolve)
            .catch(reject);
        });
      });
    });
  },
  /**
   * 返回安装进度信息
   * @returns
   */
  handleProgressInformation: function () {
    const self = this;
    self._lineIndex = 0;
    ui.showModal(_("Info"), [
      E("div", {}, [
        E(
          "ul",
          {
            id: "id_progress_information",
            style: "height:500px;overflow-y:auto;margin-left:0;",
          },
          [E("li", { class: "spinning" }, _("Loading data…"))]
        ),
      ]),
      E("div", { class: "right" }, [
        E(
          "button",
          {
            class: "btn cbi-button",
            "data-finish": "cancel",
            id: "id_btn_progress",
            click: ui.createHandlerFn(this, function (ev) {
              poll.stop();
              const finish = ev.target.getAttribute("data-finish");
              return fs
                .exec("/usr/libexec/zdinnav", ["close_progress", finish])
                .then((o) => {
                  if (Number(o.code) != 0) {
                    self.notification(JSON.stringify(o), "error");
                  } else {
                    ui.hideModal();
                    self.refreshView();
                  }
                });
            }),
          },
          _("Cancel")
        ),
      ]),
    ]);

    if (poll.queue.length > 0) {
      // 触发轮询事件
      poll.start();
    } else {
      // 添加轮询事件
      this.pollProgress();
    }
  },
  /**
   * 表单存储的配置数据获取
   * @returns
   */
  handleZdinNavRunInfo: function () {
    return new Promise(function (resolve, reject) {
      fs.exec("/usr/libexec/zdinnav", ["get_zdinNav_run_info"])
        .then((o) => {
          if (Number(o.code) != 0) {
            reject(new Error(JSON.stringify(o)));
          } else {
            resolve(JSON.parse(o.stdout));
          }
        })
        .catch(reject);
    });
  },
  /**
   * 返回 zdinnav 配置数据(字段与zdinnav相同)
   * @returns
   */
  handleFromData: function () {
    const self = this;
    return new Promise(function (resolve, reject) {
      fs.exec("/usr/libexec/zdinnav", ["get_zdinNav_from_info"])
        .then((o) => {
          if (Number(o.code) != 0) {
            reject(new Error(JSON.stringify(o)));
          } else {
            self._configData = JSON.parse(o.stdout);
            resolve(self._configData.form_data);
          }
        })
        .catch(reject);
    });
  },
  /**
   *
   * @param {string[]} field 需要校验的字段、需要实体化字段
   * @returns 返回字段对象，为空 表示 校验不通过
   */
  formValidation: function (field) {
    const formData = $("#id_form_zdinnav").serializeArray();
    if (!formData || formData.length <= 0) {
      // 抛出异常提示
      this.notification(
        _("Installation failed, unable to retrieve form data."),
        "error"
      );
      return null;
    }
    if (field.length <= 0) {
      // 抛出异常提示
      this.notification("field 不能为空", "warning");
      return null;
    }

    const self = this;
    // 实体化对象
    const result = {};
    // 错误信息
    const error = [];
    // 指定的字段实体化
    $.each(formData, function (i, o) {
      if (field.includes(o.name)) {
        const val = (o.value + "").replace(/^\s+|\s+$/g, "");
        // 数据有效性校验
        const validation = self.regexValidation(o.name, val);
        if (validation === true) {
          //对象数据赋值
          switch (o.name) {
            case "config_path":
              //路径地址单独处理
              result[o.name] = val.replace(/\/$/, "");
              break;
            default:
              result[o.name] = val;
              break;
          }
        } else {
          // 添加空字符串，防止下面校验 误认为没有校验到该字段
          result[o.name] = "";
          // 添加错误信息
          error.push(validation);
        }
      }
    });

    // 查找无效字段
    const invalidField = field.filter((item) => !result.hasOwnProperty(item));
    if (invalidField.length > 0) {
      error.push("找不到该字段：" + invalidField.join("、"));
    }
    // 异常信息检查
    if (error.length > 0) {
      const htmlMessage = error.map((msg) => `<div>${msg}</div>`).join("");
      this.notification(htmlMessage, "warning");
      return null;
    }

    // 校验通过
    return result;
  },
  /**
   * 对象数据转数组
   * @param {object} data 表单对象数据
   * @param {string[]} field 需要校验的字段、需要实体化字段
   */
  objToArray: function (data, field) {
    const valArray = [];
    $.each(field, function (i, f) {
      valArray.push(data[f]);
    });
    return valArray;
  },
  /**
   *
   * @returns {Object} 返回用obj对象
   * @returns {string} obj.isHttps - https、http访问类型
   * @returns {string} obj.port - 端口号
   */
  onOpenZdinNav: function (obj) {
    window.open(
      (obj.isHttps ? "https" : "http") +
        "://" +
        location.hostname +
        ":" +
        obj.port,
      _("ZdinNav"),
      "noopener"
    );
  },
  /**
   * 重置密码
   */
  onResetPassword: function () {
    const self = this;
    ui.showModal(_("reset password"), [
      E("div", _("Are you sure you want to reset the password to: pwd123?")),
      E("div", { class: "right" }, [
        E(
          "button",
          {
            class: "btn cbi-button",
            click: ui.hideModal,
          },
          _("No")
        ),
        " ",
        E(
          "button",
          {
            class: "btn cbi-button-action",
            click: ui.createHandlerFn(this, function (ev) {
              return fs
                .exec("/usr/libexec/zdinnav", ["reset_password"])
                .then((o) => {
                  ui.hideModal();
                  if (Number(o.code) != 0) {
                    self.notification(
                      _("The password reset has failed."),
                      "error"
                    );
                  } else {
                    self.refreshView().then(function () {
                      self.notification(
                        _("Password reset successful."),
                        "success"
                      );
                    });
                  }
                });
            }),
          },
          _("Yes")
        ),
      ]),
    ]);
  },
  /**
   * 重置http访问
   */
  onResetHttp: function () {
    const self = this;
    ui.showModal(_("reset HTTP access"), [
      E("div", _("Are you sure you want to reset HTTP access?")),
      E("div", { class: "right" }, [
        E(
          "button",
          {
            class: "btn cbi-button",
            click: ui.hideModal,
          },
          _("No")
        ),
        " ",
        E(
          "button",
          {
            class: "btn cbi-button-action",
            click: ui.createHandlerFn(this, function (ev) {
              return fs
                .exec("/usr/libexec/zdinnav", ["reset_http"])
                .then((o) => {
                  ui.hideModal();
                  if (Number(o.code) != 0) {
                    self.notification(
                      _(
                        "HTTP reset failed. Please restart your soft router and try again!"
                      ),
                      "error"
                    );
                  } else {
                    self.refreshView().then(function () {
                      self.notification(
                        _("Switched to HTTP access."),
                        "success"
                      );
                    });
                  }
                });
            }),
          },
          _("Yes")
        ),
      ]),
    ]);
  },
  /**
   * 升级程序
   */
  onUpgrade: function () {
    const field = [
      "port",
      "config_path",
      "enable_offline_installation",
      "database_type",
      "connection_settings",
      "administrator_account",
      "administrator_password",
    ];
    const data = this.formValidation(field);
    if (!data) return;

    const self = this;
    ui.showModal(_("Upgrade"), [
      E(
        "div",
        _(
          "Please confirm before %s: Ensure the %s path has at least 300MB available space. Insufficient space may cause installation failure."
        ).format(_("upgrading"), data.config_path)
      ),
      E("div", { class: "right" }, [
        E(
          "button",
          {
            class: "btn cbi-button",
            click: ui.hideModal,
          },
          _("No")
        ),
        " ",
        E(
          "button",
          {
            class: "btn cbi-button-action",
            click: ui.createHandlerFn(this, function (ev) {
              return fs
                .exec(
                  "/usr/libexec/zdinnav",
                  ["upgrade"].concat(self.objToArray(data, field))
                )
                .then((o) => {
                  ui.hideModal();
                  if (Number(o.code) != 0) {
                    self.notification(JSON.stringify(o), "error");
                  } else {
                    // 返回安装进度信息
                    self.handleProgressInformation();
                  }
                });
            }),
          },
          _("Yes")
        ),
      ]),
    ]);
  },
  /**
   * 重启程序
   */
  onRestart: function () {
    const self = this;
    return fs.exec("/usr/libexec/zdinnav", ["restart"]).then((o) => {
      if (Number(o.code) != 0) {
        self.notification(JSON.stringify(o), "error");
      } else {
        self.refreshView().then(function () {
          self.notification(_("✅ Completed"), "success");
        });
      }
    });
  },
  /**
   * 停止程序
   */
  onStop: function () {
    const self = this;
    return fs.exec("/usr/libexec/zdinnav", ["stop"]).then((o) => {
      if (Number(o.code) != 0) {
        self.notification(JSON.stringify(o), "error");
      } else {
        self.refreshView();
      }
    });
  },
  /**
   * 移除程序
   */
  onRemove: function () {
    const self = this;
    ui.showModal(_("Remove"), [
      E(
        "div",
        _(
          "Removing this program will uninstall: ZdinNav Docker and image files. User configuration data will be retained."
        )
      ),
      E("div", { class: "right" }, [
        E(
          "button",
          {
            class: "btn cbi-button",
            click: ui.hideModal,
          },
          _("No")
        ),
        " ",
        E(
          "button",
          {
            class: "btn cbi-button-action",
            click: ui.createHandlerFn(this, function (ev) {
              return fs.exec("/usr/libexec/zdinnav", ["rm"]).then((o) => {
                ui.hideModal();
                if (Number(o.code) != 0) {
                  self.notification(JSON.stringify(o), "error");
                } else {
                  self.refreshView();
                }
              });
            }),
          },
          _("Yes")
        ),
      ]),
    ]);
  },
  /**
   * 启动程序
   */
  onStart: function () {
    const self = this;
    return fs.exec("/usr/libexec/zdinnav", ["start"]).then((o) => {
      if (Number(o.code) != 0) {
        self.notification(JSON.stringify(o), "error");
      } else {
        self.refreshView();
      }
    });
  },
  /**
   * 安装程序
   * @returns
   */
  onInstall: function () {
    const field = [
      "port",
      "config_path",
      "enable_offline_installation",
      "database_type",
      "connection_settings",
      "administrator_account",
      "administrator_password",
    ];
    const data = this.formValidation(field);
    if (!data) return;

    const self = this;
    ui.showModal(_("Install"), [
      E(
        "div",
        _(
          "Please confirm before %s: Ensure the %s path has at least 300MB available space. Insufficient space may cause installation failure."
        ).format(_("installation"), data.config_path)
      ),
      E("div", { class: "right" }, [
        E(
          "button",
          {
            class: "btn cbi-button",
            click: ui.hideModal,
          },
          _("No")
        ),
        " ",
        E(
          "button",
          {
            class: "btn cbi-button-action",
            click: ui.createHandlerFn(this, function (ev) {
              return fs
                .exec(
                  "/usr/libexec/zdinnav",
                  ["install"].concat(self.objToArray(data, field))
                )
                .then((o) => {
                  ui.hideModal();
                  if (Number(o.code) != 0) {
                    self.notification(JSON.stringify(o), "error");
                  } else {
                    // 返回安装进度信息
                    self.handleProgressInformation();
                  }
                });
            }),
          },
          _("Yes")
        ),
      ]),
    ]);
  },
  /**
   * 表单数据恢复初始化值
   */
  onReset: function () {
    ui.showModal(_("Reset"), [
      E(
        "div",
        _(
          "Reset only restores the page input data to its initial value and does not perform an automatic submission."
        )
      ),
      E("div", { class: "right" }, [
        E(
          "button",
          {
            class: "btn cbi-button",
            click: ui.hideModal,
          },
          _("No")
        ),
        " ",
        E(
          "button",
          {
            class: "btn cbi-button-action",
            click: ui.createHandlerFn(this, function (ev) {
              $('#id_form_zdinnav [name="port"]').val(
                this._configData.default_form_data.port
              );
              this.onSetSelect(
                "config_path",
                this._configData.default_form_data.config_path
              );
              this.onSetCheckbox(
                "enable_offline_installation",
                false,
                0,
                this.onSwitchInstallation
              );
              this.onSetSelect(
                "database_type",
                this._configData.default_form_data.database_type
              );
              this.onSetInput(
                "connection_settings",
                this._configData.default_form_data.connection_settings
              );
              this.onSetInput(
                "administrator_account",
                this._configData.default_form_data.administrator_account
              );
              this.onSetInput(
                "administrator_password",
                this._configData.default_form_data.administrator_password
              );
              ui.hideModal();
            }),
          },
          _("Yes")
        ),
      ]),
    ]);
  },
  /**
   * 重置输入框
   * @param {string} name name名称
   * @param {string} val 赋值
   */
  onSetInput: function (name, val) {
    // 输入框赋值
    $('#id_form_zdinnav [name="' + name + '"]:first').val(val);
  },
  /**
   * 多选勾选设置
   * @param {string} name name名称
   * @param {bool} isSelected 是否选中
   * @param {string} val 隐藏标签赋值
   * @param {function} call 回调函数
   */
  onSetCheckbox: function (name, isSelected, val, call) {
    const $input = $('#id_form_zdinnav [name="' + name + '"]:first');
    // 隐藏输入框赋值
    $input.val(val);
    // 多选框
    $input
      .closest(".cbi-checkbox")
      .find("input[type='checkbox']:first")
      .prop("checked", isSelected);
    if (typeof call === "function") call(isSelected);
  },
  /**
   * 下拉选中
   * @param {string} name name名称
   * @param {string} val c
   */
  onSetSelect: function (name, val) {
    const $input = $('#id_form_zdinnav [name="' + name + '"]:first');
    // 下拉数据
    const $li = $input.closest(".cbi-dropdown").find("li[data-value]");
    // 下拉数据选中
    $li.each((i, o) => {
      const $this = $(o);
      // 如果默认值为空，选中第一个
      if ($this.attr("data-value") == val || (val?.length == 0 && i == 0)) {
        $this.attr("display", "0");
        $this.attr("selected", true);
        if (val.length == 0) {
          val = $this.attr("data-value");
        }
      } else {
        $this.removeAttr("display");
        $this.removeAttr("selected");
      }
    });
    // 隐藏输入框赋值
    $input.val(val);
  },
  /**
   * 离线包检查
   * @returns
   */
  onCheckPackage: function () {
    const self = this;
    return new Promise(function (resolve, reject) {
      const path = $("#id_config_path [name='config_path']:first")
        .val()
        .replace(/^\s+|\s+$/g, "")
        .replace(/\/$/, "");
      const validation = self.regexValidation("config_path", path);
      if (validation !== true) {
        self.notification(validation, "warning");
        resolve();
        return;
      }
      fs.exec("/usr/libexec/zdinnav", ["get_package_exists", path])
        .then((o) => {
          if (Number(o.code) != 0) {
            self.notification(JSON.stringify(o), "warning");
          } else if (Number(o.stdout) != 0) {
            self.notification(
              _(
                "Unable to find the installation package. Please place the package in the following directory:%s(this path must not contain any other files)."
              ).format(path + "/downloads/*.tar"),
              "warning"
            );
          } else {
            ui.showModal(_("Offline Installation Path Verify"), [
              E("p", _("We've found the installation package.")),
              E("div", { class: "right" }, [
                E("button", { click: ui.hideModal }, [_("Dismiss")]),
              ]),
            ]);
          }
          resolve();
        })
        .catch(reject);
    });
  },
  /**
   * tab 页签切换
   * @param {string} tabName data-tab
   */
  onSwitchTab: function (tabName) {
    const settingElement = document.getElementById("id_setting_tab");
    const tabs = settingElement.querySelectorAll(".cbi-tabmenu > [data-tab]");
    tabs.forEach(function (tab) {
      if (tab.getAttribute("data-tab") == tabName) {
        tab.classList.remove("cbi-tab-disabled");
        tab.classList.add("cbi-tab");
      } else {
        tab.classList.remove("cbi-tab");
        tab.classList.add("cbi-tab-disabled");
      }
    });

    const tabsContent = settingElement.querySelectorAll(
      ".data-tab-content > [data-tab-title]"
    );
    tabsContent.forEach(function (content) {
      const isActive = content.getAttribute("data-tab-title") == tabName;
      content.setAttribute("data-tab-active", isActive);
    });
  },
  // 离线安装div显示隐藏
  onSwitchInstallation(isChecked) {
    if (isChecked) $("#id_setting_tab .local_installation").slideDown("slow");
    else $("#id_setting_tab .local_installation").slideUp("slow");
    // 隐藏标签赋值
    $("#id_enable_offline_installation").val(isChecked == true ? "1" : "0");
    $("#id_label_tar").text(
      $("#id_config_path [name='config_path']:eq(0)")
        .val()
        .replace(/^\s+|\s+$/g, "")
        .replace(/\/$/, "") + "/downloads/*.tar"
    );
  },
  /**
   * jquery加载
   * @returns
   */
  loadJQuery: function () {
    return new Promise(function (resolve, reject) {
      const script = document.createElement("script");
      // 获取jquery静态文件
      script.src = "/luci-static/resources/lib/jquery-1.12.4.min.js";
      script.onload = function () {
        resolve("jquery-1.12.4.min.js 加载成功！");
      };
      script.onerror = function () {
        reject(new Error(_("jquery-1.12.4.min.js failed to load!")));
      };
      // 脚本插入到页面中才会开始加载
      document.head.appendChild(script);
    });
  },
  /**
   * css加载
   * @returns
   */
  loadCSS: function () {
    return new Promise(function (resolve, reject) {
      const link = document.createElement("link");
      link.type = "text/css";
      link.rel = "stylesheet";
      link.href = "/luci-static/resources/css/zdinnav.css";

      link.onload = function () {
        resolve("zdinnav.css 加载成功！");
      };
      link.onerror = function () {
        reject(new Error(_("zdinnav.css failed to load!")));
      };
      document.head.appendChild(link);
    });
  },
  load: function () {
    return Promise.all([this.loadJQuery(), this.loadCSS()]).then(() =>
      Promise.all([this.handleFromData(), this.handleZdinNavRunInfo()])
    );
  },
  /**
   * 渲染页面数据
   * @param {load function} data load 返回数据
   * @returns {E} 返回E类的新实例
   */
  loadView: function (data) {
    // 表单填充数据
    const formData = data[0];
    // 程序运行状态信息
    const zdinNavRunInfo = data[1];
    // 安装进度信息
    if (this._configData.other_config.process_id.length > 0) {
      this.handleProgressInformation();
    }

    // tabs数据
    const tabs = [];
    tabs.push(this.generalSettingsContent(zdinNavRunInfo, formData));
    tabs.push(this.advancedSettingsContent(formData));

    return E("div", { class: "cbi-section" }, [
      E("div", { class: "cbi-section" }, [
        E("h2", _("ZdinNav")),
        //智淀导航 描述
        this.zdinNavInfo(zdinNavRunInfo),
      ]),
      E("div", { class: "cbi-section" }, [
        E("h3", _("Service Status")),
        // 运行状态
        this.zdinNavState(zdinNavRunInfo),
      ]),
      E("div", { class: "cbi-section" }, [
        E("h3", _("Setup")),
        E(
          "div",
          { class: "cbi-section-node" },
          E(
            "form",
            {
              id: "id_form_zdinnav",
            },
            [
              // tab 页签 表单数据
              this.tabContents(tabs),
            ]
          )
        ),
      ]),
      E(
        "div",
        {
          class: "cbi-page-actions",
          style: "",
        },
        // button 按钮
        this.optionButtons(zdinNavRunInfo)
      ),
    ]);
  },
  /**
   * 刷新页面数据
   */
  refreshView: function () {
    return Promise.all([
      this.handleFromData(),
      this.handleZdinNavRunInfo(),
    ]).then(
      L.bind(function (data) {
        dom.content(this._container, this.loadView(data));
      }, this)
    );
  },
  /**
   * 指点导航运行状态
   * @param {*} data 需要填充的数据对象
   * @returns {Object} 返回用obj对象
   * @returns {string} obj.isInstall - 是否安装
   * @returns {E} obj.isHttps - false=Http类型， true=https类型
   */
  zdinNavInfo: function (obj) {
    return E(
      "div",
      { class: "cbi-map-descr" },
      E([
        E("ul", { class: "cbi-section-description" }, [
          E("li", [
            _(
              "ZdinNav software is a bookmark management tool for websites,Git website:"
            ),
            E(
              "a",
              {
                href: this._configData.other_config.git_url,
                target: "_blank",
              },
              _("access")
            ),
          ]),
          obj.isInstall
            ? E(
                "li",
                _("Default Ultra-Super Administrator:zdinnav Password:pwd123")
              )
            : "",
          obj.isInstall
            ? E("li", [
                _("If you forget the super administrator passwor:"),
                E(
                  "strong",
                  {
                    class: "zdinnav-a-btn",
                    click: ui.createHandlerFn(this, "onResetPassword"),
                  },
                  _("reset password")
                ),
              ])
            : "",
          obj.isHttps
            ? E("li", {}, [
                _("If HTTPS is inaccessible:"),
                E(
                  "strong",
                  {
                    class: "zdinnav-a-btn",
                    click: ui.createHandlerFn(this, "onResetHttp"),
                  },
                  _("reset HTTP access")
                ),
              ])
            : "",
        ]),
      ])
    );
  },
  /**
   * 指点导航运行状态
   * @param {*} data 需要填充的数据对象
   * @returns {Object} 返回用obj对象
   * @returns {bool} obj.status - 运行状态
   * @returns {string} obj.isInstall - 是否安装
   * @returns {E} obj.isHttps - false=Http类型， true=https类型
   */
  zdinNavState: function (obj) {
    return E(
      "div",
      { class: "cbi-map-descr" },
      E([
        E("div", { class: "cbi-value" }, [
          E("div", { class: "cbi-value-field", style: "margin-left: 150px;" }, [
            E("div", [
              E("span", _("Status")),
              E(
                "strong",
                {
                  class: obj.status ? "zdinnav-running" : "zdinnav-not-running",
                },
                [
                  obj.status
                    ? _("ZdinNav is running")
                    : _("ZdinNav is not running"),
                ]
              ),
              obj.status
                ? E(
                    "button",
                    {
                      type: "button",
                      class: "cbi-button zdinnav-open",
                      click: ui.createHandlerFn(this, "onOpenZdinNav", obj),
                    },
                    _("Open ZdinNav")
                  )
                : "",
            ]),
          ]),
        ]),
      ])
    );
  },
  /**
   * 常规设置 页签数据
   * @param {*} info handleZdinNavRunInfo 方法返回的数据
   * @returns {string} obj.autoArch - 当前系统兼容的平台版本
   * @param {*} data 表单需要填充的数据对象
   * @returns {Object} 返回用obj对象
   * @returns {string} obj.idTab - 唯一标识
   * @returns {string} obj.nameTab - tab显示别名
   * @returns {boolean} obj.active - tab 激活状态
   * @returns {E} obj.content - tab显示的内容数据
   */
  generalSettingsContent: function (info, obj) {
    const self = this;
    const tabContent = {
      idTab: "general",
      nameTab: _("General Settings"),
      active: true,
      content: E([]),
    };

    // 端口号输入框
    const port_input = new ui.Textfield(obj.port, {
      validate: function (e) {
        return self.regexValidation("port", e);
      },
      name: "port",
      optional: false,
      placeholder: _("Please enter the port number"),
    });

    // 配置文件路径
    const config_path_dropdown = new ui.Dropdown(
      obj.config_path,
      { "/overlay/configs/ZdinNav": "/overlay/configs/ZdinNav" },
      {
        sort: this.keylist,
        create: true,
        id: "id_config_path",
        name: "config_path",
        optional: false,
      }
    ).render();
    config_path_dropdown.addEventListener(
      "cbi-dropdown-change",
      ui.createHandlerFn(this, function (ev) {
        // ui.hideTooltip(ev);
        const val = ev?.detail?.value?.value;
        $("#id_label_tar").text(
          val
            ? val.replace(/^\s+|\s+$/g, "").replace(/\/$/, "") +
                "/downloads/*.tar"
            : ""
        );
      })
    );

    // 页签内容
    tabContent.content = E([
      E("div", { class: "cbi-section-description" }, [
        E(
          "p",
          {},
          _(
            "The following parameters will only take effect during installation or upgrade."
          )
        ),
      ]),
      E("div", { class: "cbi-value" }, [
        E("label", { class: "cbi-value-title" }, _("Port")),
        E("div", { class: "cbi-value-field" }, [
          port_input.render(),
          E(
            "div",
            { class: "cbi-value-description" },
            _("The port number for accessing the ZdinNav after it starts.")
          ),
        ]),
      ]),
      E("div", { class: "cbi-value" }, [
        E("label", { class: "cbi-value-title" }, _("Config path")),
        E("div", { class: "cbi-value-field" }, [
          config_path_dropdown,
          E(
            "div",
            { class: "cbi-value-description" },
            _("Configuration file path for the ZdinNav program.")
          ),
        ]),
      ]),
      E("div", { class: "cbi-value" }, [
        E(
          "label",
          { class: "cbi-value-title" },
          _("Enable Offline Installation")
        ),
        E("div", { class: "cbi-value-field" }, [
          E("div", { class: "cbi-checkbox" }, [
            E("input", {
              type: "hidden",
              id: "id_enable_offline_installation",
              name: "enable_offline_installation",
              value: obj.enable_offline_installation,
            }),
            obj.enable_offline_installation == "1"
              ? E("input", {
                  type: "checkbox",
                  checked: "checked",
                  click: ui.createHandlerFn(this, function (e) {
                    this.onSwitchInstallation(e.target.checked);
                  }),
                })
              : E("input", {
                  type: "checkbox",
                  click: ui.createHandlerFn(this, function (e) {
                    this.onSwitchInstallation(e.target.checked);
                  }),
                }),
          ]),
          E(
            "div",
            { class: "cbi-value-description" },
            _("Offline installer available for local installation.")
          ),
        ]),
      ]),
      E(
        "div",
        {
          class: "cbi-value local_installation",
          style:
            obj.enable_offline_installation == "1"
              ? "display:flex;"
              : "display:none;",
        },
        [
          E(
            "label",
            { class: "cbi-value-title" },
            _("Offline Installation Path")
          ),
          E("div", { class: "cbi-value-field" }, [
            E(
              "div",
              { class: "" },
              _("Offline Installation Description:%s").format(info.autoArch)
            ),
            E("div", { class: "" }, [
              _("Offline Installation Path Rules(Config path + %s):").format(
                "/downloads/*.tar"
              ),
              E(
                "span",
                { style: "margin-left:3px;", id: "id_label_tar" },
                obj.config_path + "/downloads/*.tar"
              ),
            ]),
            E(
              "button",
              {
                class: "cbi-button",
                type: "button",
                click: ui.createHandlerFn(this, "onCheckPackage"),
              },
              [_("Offline Installation Path Verify")]
            ),
          ]),
        ]
      ),
    ]);
    return tabContent;
  },
  /**
   * 高级设置 页签数据
   * @param {*} data 表单需要填充的数据对象
   * @returns {Object} 返回用obj对象
   * @returns {string} obj.idTab - 唯一标识
   * @returns {string} obj.nameTab - tab显示别名
   * @returns {boolean} obj.active - tab 激活状态
   * @returns {E} obj.content - tab显示的内容数据
   */
  advancedSettingsContent: function (obj) {
    const self = this;
    const tabContent = {
      idTab: "advanced",
      nameTab: _("Advanced Settings"),
      content: E([]),
    };

    // 数据库类型下拉
    const database_type_value = {
      Sqlite: _("Sqlite"),
      PostgreSQL: _("PostgreSQL"),
      MySql: _("MySql"),
    };
    const database_type_dropdown = new ui.Dropdown(
      obj.database_type,
      database_type_value,
      {
        create: true,
        name: "database_type",
        optional: false,
      }
    );

    // 数据库连接字符串
    const connection_settings_input = new ui.Textfield(
      obj.connection_settings,
      {
        validate: function (e) {
          return self.regexValidation("connection_settings", e);
        },
        name: "connection_settings",
        datatype: "string",
        optional: false,
        placeholder: _("Please enter the connection settings"),
      }
    );

    // 账号输入框
    const administrator_account_input = new ui.Textfield(
      obj.administrator_account,
      {
        validate: function (e) {
          return self.regexValidation("administrator_account", e);
        },
        name: "administrator_account",
        datatype: "string",
        optional: false,
        placeholder: _("Please enter the administrator account"),
      }
    );

    // 密码输入框
    const administrator_password_input = new ui.Textfield(
      obj.administrator_password,
      {
        validate: function (e) {
          return self.regexValidation("administrator_password", e);
        },
        name: "administrator_password",
        datatype: "string",
        optional: false,
        password: true,
        autocomplete: "current-password",
        placeholder: _("Please enter the password"),
      }
    );

    // 页签内容
    tabContent.content = E([
      E("div", { class: "cbi-section-description" }, [
        E(
          "p",
          {},
          _(
            "Takes effect when the database is initially created, or when the /ZdinNav/ folder under the configuration file path does not contain any data."
          )
        ),
        E(
          "p",
          {},
          _(
            "Modifying errors may result in data loss or system failure to boot properly. Please proceed with caution!"
          )
        ),
      ]),
      E("div", { class: "cbi-value" }, [
        E("label", { class: "cbi-value-title" }, _("Database Type")),
        E("div", { class: "cbi-value-field" }, [
          database_type_dropdown.render(),
          E(
            "div",
            { class: "" },
            _(
              "Warning: Do not modify if you are unfamiliar with the database, as it may result in system unavailability!"
            )
          ),
        ]),
      ]),
      E("div", { class: "cbi-value" }, [
        E("label", { class: "cbi-value-title" }, _("Connection Settings")),
        E("div", { class: "cbi-value-field" }, [
          connection_settings_input.render(),
          E(
            "div",
            { class: "" },
            _(
              "Warning: Do not modify if you are unfamiliar with the database, as it may result in system unavailability!"
            )
          ),
        ]),
      ]),
      E("div", { class: "cbi-value" }, [
        E("label", { class: "cbi-value-title" }, _("Administrator Account")),
        E("div", { class: "cbi-value-field" }, [
          administrator_account_input.render(),
        ]),
      ]),
      E("div", { class: "cbi-value" }, [
        E("label", { class: "cbi-value-title" }, _("Password")),
        E(
          "div",
          { class: "cbi-value-field" },
          administrator_password_input.render()
        ),
      ]),
    ]);
    return tabContent;
  },
  /**
   * 页签数据
   * @param {Object} data tab数据对象
   * @param {string} data.idTab - 唯一标识
   * @param {string} data.nameTab - tab显示别名
   * @param {string} data.content - tab显示的内容数据
   * @returns {E} 返回E类的新实例
   */
  tabContents: function (obj) {
    const tabHead = [];
    const tabContent = [];
    obj.forEach((o) => {
      // 页签头部
      tabHead.push(
        E(
          "li",
          {
            class: o.active === true ? "cbi-tab" : "cbi-tab-disabled",
            "data-tab": o.idTab,
          },
          [
            E(
              "a",
              {
                style: "cursor: pointer;",
                click: ui.createHandlerFn(this, "onSwitchTab", o.idTab),
              },
              o.nameTab
            ),
          ]
        )
      );
      // 页签内容
      tabContent.push(
        E(
          "div",
          {
            "data-tab-title": o.idTab,
            "data-tab-active": o.active === true,
            class: "cbi-section",
          },
          o.content
        )
      );
    });
    return E("div", { id: "id_setting_tab" }, [
      // 页签头部
      E("ul", { class: "cbi-tabmenu" }, tabHead),
      // 页签内容
      E("ul", { class: "data-tab-content" }, tabContent),
    ]);
  },
  /**
   *
   * @param {*} data 数据对象
   * @param {Object} 返回用obj对象
   * @param {bool} obj.status - 运行状态
   * @param {string} obj.isInstall - 是否安装
   * @returns {E} 返回E类的新实例
   */
  optionButtons: function (obj) {
    const buttons = E([]);

    if (obj.isInstall) {
      // 已安装，才能出现升级按钮
      buttons.appendChild(
        E(
          "button",
          {
            class: "cbi-button cbi-button-apply",
            style: "margin-left:6px;",
            type: "button",
            click: ui.createHandlerFn(this, "onUpgrade"),
          },
          [_("Upgrade")]
        )
      );
      if (obj.status) {
        // 启动状态显示停 重启按钮
        buttons.appendChild(
          E(
            "button",
            {
              class: "cbi-button cbi-button-apply zdinnav-restart-btn",
              type: "button",
              click: ui.createHandlerFn(this, "onRestart"),
            },
            [_("Restart")]
          )
        );
        // 启动状态显示停止按钮
        buttons.appendChild(
          E(
            "button",
            {
              class: "cbi-button cbi-button-apply zdinnav-stop-btn",
              type: "button",
              click: ui.createHandlerFn(this, "onStop"),
            },
            [_("Stop")]
          )
        );
      } else {
        // 停止状态显示 启动按钮
        buttons.appendChild(
          E(
            "button",
            {
              class: "cbi-button cbi-button-apply zdinnav-start-btn",
              type: "button",
              click: ui.createHandlerFn(this, "onStart"),
            },
            [_("Start")]
          )
        );
        // 停止状态显示 移除按钮
        buttons.appendChild(
          E(
            "button",
            {
              class: "cbi-button cbi-button-apply zdinnav-remove-btn",
              type: "button",
              click: ui.createHandlerFn(this, "onRemove"),
            },
            [_("Remove")]
          )
        );
      }
    } else {
      // 未安装，显示安装按钮
      buttons.appendChild(
        E(
          "button",
          {
            class: "cbi-button cbi-button-apply",
            style: "margin-left:6px;",
            type: "button",
            click: ui.createHandlerFn(this, "onInstall"),
          },
          [_("Install")]
        )
      );
    }
    // 复位重置
    buttons.appendChild(
      E(
        "button",
        {
          class: "cbi-button cbi-button-reset",
          style: "margin-left:6px;",
          type: "reset",
          click: ui.createHandlerFn(this, "onReset"),
        },
        [_("Reset")]
      )
    );

    return buttons;
  },
  render: function (data) {
    var content = E([E("div", { class: "zdinnav-container" }, [])]);
    this._container = content.lastElementChild;
    // 安装进度信息
    if (this._configData.other_config.process_id.length > 0) {
      this.handleProgressInformation();
    }
    //加载页面数据
    dom.content(this._container, this.loadView(data));
    return content;
  },
  handleSave: null,
  handleSaveApply: null,
  handleReset: null,
});
