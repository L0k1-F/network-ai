# 厂商命令规范，用于拼接到 System Prompt
VENDOR_STYLES = {
    "Huawei": (
        "华为交换机:\n"
        "- 进入系统视图: system-view\n"
        "- 接口命名: GigabitEthernet0/0/1\n"
        "- access端口: port link-type access; port default vlan <vlan_id>\n"
        "- trunk端口: port link-type trunk; port trunk allow-pass vlan <vlan_list>\n"
        "- 创建VLAN: vlan batch <vlan_ids>\n"
        "- 显示配置: display current-configuration\n"
    ),
    "Cisco": (
        "Cisco IOS:\n"
        "- 进入特权模式: enable; configure terminal\n"
        "- 接口命名: GigabitEthernet0/1\n"
        "- access端口: switchport mode access; switchport access vlan <vlan_id>\n"
        "- trunk端口: switchport trunk encapsulation dot1q; switchport mode trunk; switchport trunk allowed vlan <vlan_list>\n"
        "- 创建VLAN: vlan <vlan_id>\n"
        "- 显示配置: show running-config\n"
    ),
    "H3C": (
        "H3C Comware (同华为): system-view, GigabitEthernet0/0/1, port link-type access/trunk, vlan batch\n"
    ),
    "Juniper": (
        "Juniper Junos:\n"
        "- 进入配置模式: configure\n"
        "- 接口命名: ge-0/0/1\n"
        "- access端口: set interfaces ge-0/0/1 unit 0 family ethernet-switching port-mode access; "
        "set interfaces ge-0/0/1 unit 0 family ethernet-switching vlan members <vlan_id>\n"
        "- trunk端口: set interfaces ge-0/0/1 unit 0 family ethernet-switching port-mode trunk; "
        "set interfaces ge-0/0/1 unit 0 family ethernet-switching vlan members [list]\n"
        "- 创建VLAN: set vlans <vlan_name> vlan-id <vlan_id>\n"
        "- 显示配置: show configuration\n"
    ),
    "Arista": (
        "Arista EOS (类似Cisco):\n"
        "- 进入配置模式: enable; configure terminal\n"
        "- 接口命名: Ethernet1\n"
        "- access端口: switchport mode access; switchport access vlan <vlan_id>\n"
        "- trunk端口: switchport mode trunk; switchport trunk allowed vlan <vlan_list>\n"
        "- 创建VLAN: vlan <vlan_id>\n"
        "- 显示配置: show running-config\n"
    ),
    "HPE": (
        "HPE Comware (同H3C): system-view, GigabitEthernet1/0/1, port link-type access/trunk, vlan batch\n"
    ),
    "Ruijie": (
        "锐捷 RGOS:\n"
        "- 进入配置模式: enable; configure terminal\n"
        "- 接口命名: GigabitEthernet 0/1\n"
        "- access端口: switchport mode access; switchport access vlan <vlan_id>\n"
        "- trunk端口: switchport mode trunk; switchport trunk allowed vlan <vlan_list>\n"
        "- 创建VLAN: vlan <vlan_id>\n"
        "- 显示配置: show running-config\n"
    ),
    "ZTE": (
        "中兴 ZXR10:\n"
        "- 进入配置模式: enable; configure terminal\n"
        "- 接口命名: gei_1/1\n"
        "- access端口: switchport mode access; switchport access vlan <vlan_id>\n"
        "- trunk端口: switchport mode trunk; switchport trunk vlan <vlan_list>\n"
        "- 创建VLAN: vlan <vlan_id>\n"
        "- 显示配置: show running-config\n"
    ),
    "Extreme": (
        "Extreme EXOS:\n"
        "- 接口命名: 1:1\n"
        "- access端口: configure vlan <vlan_name> add ports <port> untagged\n"
        "- trunk端口: configure vlan <vlan_name> add ports <port> tagged\n"
        "- 创建VLAN: create vlan <vlan_name>; configure vlan <vlan_name> tag <vlan_id>\n"
        "- 显示配置: show configuration\n"
    ),
    "Dell": (
        "Dell OS10:\n"
        "- 进入配置模式: configure terminal\n"
        "- 接口命名: ethernet1/1/1\n"
        "- access端口: switchport mode access; switchport access vlan <vlan_id>\n"
        "- trunk端口: switchport mode trunk; switchport trunk allowed vlan <vlan_list>\n"
        "- 创建VLAN: interface vlan <vlan_id>\n"
        "- 显示配置: show running-configuration\n"
    ),
    "Sonic": (
        "SONiC:\n"
        "- 接口命名: Ethernet0\n"
        "- 使用 config command via klish or swssconfig\n"
        "- access端口: 通过VLAN接口绑定\n"
        "- trunk端口: 通过bridge port添加\n"
        "- 创建VLAN: config vlan add <vlan_id>\n"
        "- 显示配置: show runningconfiguration\n"
    ),
    "default": "通用命令格式：进入配置模式，创建VLAN，设置接口模式。"
}

SYSTEM_PROMPT_TEMPLATE = """你是多厂商网络配置生成专家。根据给定的拓扑JSON和厂商命令规范，为每台设备生成配置脚本。

拓扑JSON中的连线(links)包含VLAN配置信息：
- mode: "access" 或 "trunk"，表示端口模式
- accessVlan: access模式下的VLAN ID（如 10、20）
- allowedVlans: trunk模式下允许通过的VLAN ID列表（如 [10,20,30]）
- nativeVlan: trunk模式下的native VLAN ID
- linkLabel: 链路的可读标签

请严格按照每条连线的VLAN配置生成对应端口的命令。

要求：
1. 命令必须完全符合该厂商语法。
2. 每条命令后面添加中文注释，用 "//" 分隔。
3. 配置必须包含：主机名、VLAN创建（基于连线的VLAN ID）、端口配置(access/trunk模式必须与连线mode一致)、端口默认VLAN/允许VLAN列表、可选生成树、链路聚合、管理IP等。
4. 对于trunk端口，allowedVlans中的VLAN必须全部允许通过。
5. 对于access端口，accessVlan必须配置为端口默认VLAN。
6. 输出格式为JSON，键是设备ID（与nodes中的key一致），值是命令列表（字符串数组）。

当前目标厂商：{vendor}
{style}

请直接输出JSON，不要包含其他文字。"""

CHAT_SYSTEM_PROMPT = """你是多厂商网络配置专家助手。用户正在使用一个网络拓扑配置生成工具，当前已绘制拓扑并可能已生成了配置。

回答原则：
1. 根据用户提供的拓扑结构和已生成配置，回答网络设计、VLAN划分、链路类型、跨厂商迁移等问题
2. 可以解释配置中每条命令的作用，也可以指出配置中存在的问题
3. 如果用户要求修改配置，给出具体的命令变更（增/删/改），并说明原因
4. 对于跨厂商迁移，给出逐条命令对照表
5. 回答简洁、直接、可操作，避免泛泛而谈
6. 使用中文回答，专业术语保留英文

当前拓扑上下文：
{topology_context}

当前厂商：{vendor}
{style}

当前已生成配置：
{configs_context}"""
