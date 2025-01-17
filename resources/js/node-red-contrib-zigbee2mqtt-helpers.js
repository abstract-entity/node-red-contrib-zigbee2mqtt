class Zigbee2MqttEditor {
    constructor(node, config = {}) {
        this.node = node;
        this.devices = null;
        this.config = Object.assign( {
            allow_empty:false
        }, config);
        this.device_id = node.device_id||null;
        this.property = node.state||null;
        this.optionsValue = node.optionsValue||null;
        this.optionsType = node.optionsType||null;
        this.refresh = false;

        return this;
    }

    bind() {
        let that = this;
        that.getRefreshBtn().off('click').on('click', () => {
            that.refresh = true;
            that.build();
        });
        that.getServerInput().off('change').on('change', (e) => {
            that.property = null;
            that.refresh = true;
            that.build();
        });
        that.getDeviceIdInput().off('change').on('change', () => {
            that.device_id = that.getDeviceIdInput().val();
            that.build();
        });
        if (that.getDeviceOptionsInput()) {
            that.getDeviceOptionsInput().off('change').on('change', (event, type, value) => {
                that.optionsValue = value;
                that.optionsType = type;
                that.buildDeviceOptionsHelpBlock();
            });
        }
    }

    async build() {
        let that = this;
        // console.log('build : '+(this.refresh?'true':false));
        await that.buildDeviceIdInput().then(()=>{
            that.buildDevicePropertyInput();
            that.buildDeviceOptionsInput();
        });
        that.bind();
    }

    async buildDeviceIdInput() {
        let that = this;
        // console.log('BUILD buildDeviceIdInput');

        let params = {
            maxHeight: 300,
            dropWidth: 320,
            width: 320,
            filter: true,
            minimumCountSelected:1,
            formatAllSelected:function(){return RED._("node-red-contrib-zigbee2mqtt/server:editor.select_device")}
        };
        if (that.config.allow_empty) {
            params.formatAllSelected = function(){return RED._("node-red-contrib-zigbee2mqtt/server:editor.msg_topic")};
        }

        that.getDeviceIdInput().children().remove();
        that.getDeviceIdInput().multipleSelect('destroy').multipleSelect(params).multipleSelect('disable');

        let data = await that.getDevices();

        if (that.config.allow_empty) {
            that.getDeviceIdInput().html('<option value="">msg.topic</option>');
        }

        var names = {};
        let html = '';

        //groups
        let groups = data[1];
        if (groups.length) {
            html = $('<optgroup/>', {label: RED._("node-red-contrib-zigbee2mqtt/server:editor.groups")});
            html.appendTo(that.getDeviceIdInput());
            $.each(groups, function(index, value) {
                names[value.id] = value.friendly_name;
                let text = '';
                if ("devices" in value && typeof (value.devices) != 'undefined' && value.devices.length > 0) {
                    text = ' (' + value.devices.length + ')';
                }
                $('<option value="' + value.id + '" data-friendly_name="' + value.friendly_name + '">' + value.friendly_name + text + '</option>')
                    .appendTo(html);
            });
        }

        //devices
        let devices = data[0];
        if (devices.length) {
            html = $('<optgroup/>', {label: RED._("node-red-contrib-zigbee2mqtt/server:editor.devices")});
            html.appendTo(that.getDeviceIdInput());
            $.each(devices, function(index, value) {
                names[value.ieee_address] = value.friendly_name;
                var model = '';
                if ("definition" in value && value.definition && "model" in value.definition && typeof (value.definition.model) !== undefined) {
                    model = ' (' + value.definition.model + ')';
                }
                $('<option value="' + value.ieee_address + '" data-friendly_name="' + value.friendly_name + '">' + value.friendly_name + model + '</option>')
                    .appendTo(html);
            });
        }

        that.getDeviceIdInput().multipleSelect('enable');
        if (that.device_id &&that.getDeviceIdInput().find('option[value='+that.device_id+']').length) {
            that.getDeviceIdInput().val(that.device_id);
        } else {
            that.device_id = null;
        }
        that.getDeviceIdInput().multipleSelect('refresh');
        that.getDeviceFriendlyNameInput().val(that.device_id in names ? names[that.device_id]: '');

        return this;
    }

    async buildDevicePropertyInput() {
        let that = this;
        if (!that.getDevicePropertyInput()) return;
        //console.log('BUILD buildDevicePropertyInput');

        that.getDevicePropertyInput().children().remove();
        that.getDevicePropertyInput().multipleSelect('destroy').multipleSelect({
            numberDisplayed: 1,
            dropWidth: 320,
            width: 320,
            single: !(typeof $(this).attr('multiple') !== typeof undefined && $(this).attr('multiple') !== false)
        }).multipleSelect('disable');

        that.getDevicePropertyInput().html('<option value="0">'+ RED._("node-red-contrib-zigbee2mqtt/server:editor.complete_payload")+'</option>');

        let html = '';
        let device = that.getDevice();

        if (device && 'definition' in device && device.definition && 'exposes' in device.definition) {
            html = $('<optgroup/>', {label: RED._("node-red-contrib-zigbee2mqtt/server:editor.zigbee2mqtt")});
            html.appendTo(that.getDevicePropertyInput());

            $.each(device.definition.exposes, function(index, value) {
                if ('property' in value) {
                    $('<option  value="' + value.property + '">' + value.name + (value.unit ? ', ' + value.unit : '') + '</option>')
                        .appendTo(html);
                }
            });
        }

        if (device && 'homekit' in device && Object.keys(device.homekit).length) {
            html = $('<optgroup/>', {label: RED._("node-red-contrib-zigbee2mqtt/server:editor.homekit")});
            html.appendTo(that.getDevicePropertyInput());

            $.each(device.homekit, function (index, value) {
                $('<option  value="homekit_' + index + '">' + index + '</option>').appendTo(html);
            });
        }

        that.getDevicePropertyInput().multipleSelect('enable');
        if (that.getDevicePropertyInput().find('option[value='+that.property+']').length) {
            that.getDevicePropertyInput().val(that.property);
        } else {
            that.getDevicePropertyInput().val(that.getDevicePropertyInput().find('option').eq(0).attr('value'));
        }
        that.getDevicePropertyInput().multipleSelect('refresh');
    }

    buildDeviceOptionsInput() {
        let that = this;
        if (!that.getDeviceOptionsInput()) return;

        // console.log('BUILD buildDeviceOptionsInput');
        let device = that.getDevice();
        let options = [];
        options.push({'value': 'nothing', 'label': RED._("node-red-contrib-zigbee2mqtt/server:editor.nothing"), options:['']});
        options.push('msg');
        options.push('json');
        if (device && 'definition' in device && device.definition && 'options' in device.definition) {
            $.each(device.definition.options, function(k, v) {
                options.push({'value': v.property, 'label': v.name});
            });
        }
        that.getDeviceOptionsInput().typedInput({
            default: 'nothing',
            value: that.optionsType,
            typeField: that.getDeviceOptionsTypeInput(),
        });
        that.getDeviceOptionsInput().typedInput('types', options);
        that.getDeviceOptionsInput().typedInput('type', that.optionsType || 'nothing');
        that.getDeviceOptionsInput().typedInput('value', that.optionsValue || '');
        that.buildDeviceOptionsHelpBlock();
    }

    buildDeviceOptionsHelpBlock() {
        let that = this;
        if (!that.getDeviceOptionsTypeHelpBlock()) return;

        // console.log('BUILD buildDeviceOptionsHelpBlock');

        that.getDeviceOptionsTypeHelpBlock().hide().find('div').text('').closest('.form-tips').find('span').text('');

        let device = that.getDevice();
        let selectedOption = null;
        if (device && 'definition' in device && device.definition && 'options' in device.definition) {
            $.each(device.definition.options, function(k, v) {
                if ('json' === that.optionsType) {
                    let json = {};
                    $.each(device.definition.options, function(k, v2) {
                        if ('property' in v2) {
                            let defaultVal = '';
                            if ('type' in v2) {
                                if (v2.type==='numeric') {
                                    defaultVal = 0;
                                    if ('value_min' in v2) {
                                        defaultVal = v2.value_min;
                                    }
                                } else if (v2.type==='binary') {
                                    defaultVal = false;
                                }
                            }
                            json[v2.property] = defaultVal;
                        }
                    });
                    selectedOption = {'name':'JSON', 'description':JSON.stringify(json, null, 4)};
                    return false;
                }
                if (v.property === that.optionsType) {
                    selectedOption = v;
                    return false;
                }
            });
        }

        if (selectedOption && 'description' in selectedOption && selectedOption.description) {
            that.getDeviceOptionsTypeHelpBlock().show().find('div').text(selectedOption.name).closest('.form-tips').find('span').text(selectedOption.description);
        }
    }

    async getDevices() {
        let that = this;
        if (that.devices === null || that.refresh) {
            const response = await fetch('zigbee2mqtt/getDevices?' + new URLSearchParams({
                controllerID: that.getServerInput().val(),
                forceRefresh: that.refresh
            }).toString(), {
                method: 'GET',
                cache: 'no-cache',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            that.refresh = false;
            that.devices = await response.json();
            return that.devices;
        } else {
            return await new Promise(function(resolve, reject) {
                resolve(that.devices);
            });
        }
    }

     getDevice() {
        let that = this;
        let devices = that.devices[0];
        let device = null;
        if (devices.length) {
            $.each(devices, function (index, item) {
                if (item.ieee_address === that.device_id) {
                    device = item;
                    return false;
                }
            });
        }
        return device;
    }

    getDeviceIdInput() {
        return $('#node-input-device_id');
    }

    getDevicePropertyInput() {
        let $elem = $('#node-input-state');
        return $elem.length?$elem:null;
    }

    getDeviceOptionsInput() {
        let $elem = $('#node-input-optionsValue');
        return $elem.length?$elem:null;
    }

    getDeviceOptionsTypeInput() {
        let $elem = $('#node-input-optionsType');
        return $elem.length?$elem:null;
    }

    getDeviceOptionsTypeHelpBlock() {
        return $('.optionsType_description');
    }

    getDeviceFriendlyNameInput() {
        return $('#node-input-friendly_name');
    }

    getServerInput() {
        return $('#node-input-server');
    }

    getRefreshBtn() {
        return $('#force-refresh');
    }
}
