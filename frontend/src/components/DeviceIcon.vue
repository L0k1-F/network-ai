<template>
  <svg width="36" height="36" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
    <!-- Router -->
    <template v-if="type === 'router'">
      <rect x="2" y="8" width="32" height="20" rx="4" fill="#4FC3F7" stroke="#0277BD" stroke-width="1.5"/>
      <rect x="6" y="12" width="5" height="2.5" fill="#37474F" rx="0.5"/>
      <rect x="13" y="12" width="5" height="2.5" fill="#37474F" rx="0.5"/>
      <rect x="20" y="12" width="5" height="2.5" fill="#37474F" rx="0.5"/>
      <rect x="27" y="12" width="5" height="2.5" fill="#37474F" rx="0.5"/>
      <rect x="6" y="17" width="5" height="2.5" fill="#37474F" rx="0.5"/>
      <rect x="13" y="17" width="5" height="2.5" fill="#37474F" rx="0.5"/>
      <rect x="20" y="17" width="5" height="2.5" fill="#37474F" rx="0.5"/>
      <rect x="27" y="17" width="5" height="2.5" fill="#37474F" rx="0.5"/>
      <circle cx="8" cy="23" r="1.5" fill="#4CAF50"/>
      <circle cx="14" cy="23" r="1.5" fill="#4CAF50"/>
      <circle cx="20" cy="23" r="1.5" fill="#FFC107"/>
      <circle cx="26" cy="23" r="1.5" fill="#4CAF50"/>
    </template>
    <!-- Switch -->
    <template v-else-if="type === 'switch'">
      <rect x="1" y="7" width="34" height="22" rx="3" fill="#546E7A" stroke="#263238" stroke-width="1.5"/>
      <rect x="5" y="11" width="3.5" height="2" fill="#B0BEC5" rx="0.5"/>
      <rect x="10" y="11" width="3.5" height="2" fill="#B0BEC5" rx="0.5"/>
      <rect x="15" y="11" width="3.5" height="2" fill="#B0BEC5" rx="0.5"/>
      <rect x="20" y="11" width="3.5" height="2" fill="#B0BEC5" rx="0.5"/>
      <rect x="25" y="11" width="3.5" height="2" fill="#B0BEC5" rx="0.5"/>
      <rect x="30" y="11" width="3.5" height="2" fill="#B0BEC5" rx="0.5"/>
      <rect x="5" y="16" width="3.5" height="2" fill="#B0BEC5" rx="0.5"/>
      <rect x="10" y="16" width="3.5" height="2" fill="#B0BEC5" rx="0.5"/>
      <rect x="15" y="16" width="3.5" height="2" fill="#B0BEC5" rx="0.5"/>
      <rect x="20" y="16" width="3.5" height="2" fill="#B0BEC5" rx="0.5"/>
      <rect x="25" y="16" width="3.5" height="2" fill="#B0BEC5" rx="0.5"/>
      <rect x="30" y="16" width="3.5" height="2" fill="#B0BEC5" rx="0.5"/>
      <circle cx="12" cy="23" r="1.5" fill="#4CAF50"/>
      <circle cx="18" cy="23" r="1.5" fill="#4CAF50"/>
      <circle cx="24" cy="23" r="1.5" fill="#FFC107"/>
    </template>
    <!-- PC -->
    <template v-else-if="type === 'pc'">
      <rect x="3" y="2" width="30" height="22" rx="3" fill="#263238"/>
      <rect x="6" y="5" width="24" height="16" rx="2" fill="#1565C0"/>
      <rect x="15" y="24" width="6" height="5" fill="#37474F" rx="0.5"/>
      <rect x="8" y="28" width="20" height="3" rx="1.5" fill="#37474F"/>
    </template>
    <!-- Server -->
    <template v-else-if="type === 'server'">
      <rect x="4" y="1" width="28" height="34" rx="3" fill="#424242" stroke="#212121" stroke-width="1.5"/>
      <rect x="8" y="6" width="20" height="5" rx="1" fill="#616161"/>
      <circle cx="24" cy="8.5" r="1.5" fill="#4CAF50"/>
      <rect x="8" y="14" width="20" height="5" rx="1" fill="#616161"/>
      <circle cx="24" cy="16.5" r="1.5" fill="#4CAF50"/>
      <rect x="8" y="22" width="20" height="5" rx="1" fill="#616161"/>
      <circle cx="24" cy="24.5" r="1.5" fill="#FFC107"/>
      <rect x="8" y="29" width="8" height="1.5" rx="0.5" fill="#757575"/>
      <rect x="18" y="29" width="8" height="1.5" rx="0.5" fill="#757575"/>
    </template>
    <!-- Firewall -->
    <template v-else-if="type === 'firewall'">
      <rect x="2" y="7" width="32" height="22" rx="4" fill="#FF7043" stroke="#BF360C" stroke-width="1.5"/>
      <rect x="8" y="13" width="20" height="3" rx="1" fill="#BF360C"/>
      <circle cx="12" cy="23" r="1.5" fill="#4CAF50"/>
      <circle cx="18" cy="23" r="1.5" fill="#FFC107"/>
      <circle cx="24" cy="23" r="1.5" fill="#4CAF50"/>
    </template>
    <!-- AP (Wireless Access Point) -->
    <template v-else-if="type === 'ap'">
      <rect x="8" y="18" width="20" height="15" rx="6" fill="#ECEFF1" stroke="#546E7A" stroke-width="1.5"/>
      <path d="M11 14 Q18 7 25 14" fill="none" stroke="#1565C0" stroke-width="1.5"/>
      <path d="M14 11 Q18 7 22 11" fill="none" stroke="#1565C0" stroke-width="1.5"/>
      <circle cx="18" cy="8" r="1.5" fill="#1565C0"/>
    </template>
    <!-- AC (Wireless Controller) -->
    <template v-else-if="type === 'ac'">
      <rect x="2" y="8" width="32" height="20" rx="4" fill="#7E57C2" stroke="#4A148C" stroke-width="1.5"/>
      <circle cx="9" cy="21" r="1.5" fill="#4CAF50"/>
      <circle cx="15" cy="21" r="1.5" fill="#4CAF50"/>
      <circle cx="21" cy="21" r="1.5" fill="#4CAF50"/>
      <circle cx="27" cy="21" r="1.5" fill="#FFC107"/>
      <rect x="8" y="12" width="20" height="3" rx="1" fill="#4A148C"/>
    </template>
    <!-- Laptop -->
    <template v-else-if="type === 'laptop'">
      <rect x="4" y="4" width="28" height="20" rx="3" fill="#37474F" stroke="#000" stroke-width="1.5"/>
      <rect x="7" y="7" width="22" height="14" rx="2" fill="#1565C0"/>
      <rect x="1" y="24" width="34" height="5" rx="2" fill="#37474F" stroke="#263238" stroke-width="1"/>
    </template>
    <!-- IP Phone -->
    <template v-else-if="type === 'phone'">
      <rect x="6" y="3" width="24" height="30" rx="4" fill="#37474F" stroke="#000" stroke-width="1.5"/>
      <rect x="10" y="7" width="16" height="18" rx="2" fill="#E0E0E0" stroke="#BDBDBD" stroke-width="0.5"/>
      <circle cx="18" cy="28" r="2" fill="#78909C"/>
    </template>
    <!-- Camera (Dome) -->
    <template v-else-if="type === 'camera'">
      <rect x="4" y="14" width="28" height="18" rx="2" fill="#ECEFF1" stroke="#37474F" stroke-width="1.5"/>
      <path d="M6 14 Q18 2 30 14" fill="#B0BEC5" stroke="#546E7A" stroke-width="1.5"/>
      <circle cx="18" cy="19" r="5" fill="#263238"/>
      <circle cx="18" cy="19" r="3" fill="#1565C0"/>
      <circle cx="18" cy="19" r="1.5" fill="#42A5F5"/>
      <rect x="4" y="12" width="3" height="4" fill="#546E7A" rx="0.5"/>
    </template>
    <!-- NVR (Network Video Recorder) -->
    <template v-else-if="type === 'nvr'">
      <rect x="2" y="4" width="32" height="28" rx="3" fill="#37474F" stroke="#212121" stroke-width="1.5"/>
      <rect x="6" y="8" width="24" height="4" rx="1" fill="#616161"/>
      <circle cx="26" cy="10" r="1" fill="#F44336"/>
      <rect x="6" y="15" width="24" height="4" rx="1" fill="#616161"/>
      <circle cx="26" cy="17" r="1" fill="#4CAF50"/>
      <rect x="6" y="22" width="24" height="4" rx="1" fill="#616161"/>
      <circle cx="26" cy="24" r="1" fill="#4CAF50"/>
      <rect x="12" y="28" width="12" height="2" rx="1" fill="#757575"/>
    </template>
    <!-- Dumb Switch (Unmanaged) -->
    <template v-else-if="type === 'dumb-switch'">
      <rect x="1" y="7" width="34" height="22" rx="3" fill="#78909C" stroke="#455A64" stroke-width="1.5"/>
      <rect x="5" y="11" width="3" height="2" fill="#CFD8DC" rx="0.5"/>
      <rect x="10" y="11" width="3" height="2" fill="#CFD8DC" rx="0.5"/>
      <rect x="15" y="11" width="3" height="2" fill="#CFD8DC" rx="0.5"/>
      <rect x="20" y="11" width="3" height="2" fill="#CFD8DC" rx="0.5"/>
      <rect x="25" y="11" width="3" height="2" fill="#CFD8DC" rx="0.5"/>
      <rect x="30" y="11" width="3" height="2" fill="#CFD8DC" rx="0.5"/>
      <rect x="5" y="16" width="3" height="2" fill="#CFD8DC" rx="0.5"/>
      <rect x="10" y="16" width="3" height="2" fill="#CFD8DC" rx="0.5"/>
      <rect x="15" y="16" width="3" height="2" fill="#CFD8DC" rx="0.5"/>
      <rect x="20" y="16" width="3" height="2" fill="#CFD8DC" rx="0.5"/>
      <rect x="25" y="16" width="3" height="2" fill="#CFD8DC" rx="0.5"/>
      <rect x="30" y="16" width="3" height="2" fill="#CFD8DC" rx="0.5"/>
      <rect x="4" y="22" width="28" height="4" rx="1" fill="#455A64"/>
      <text x="18" y="26" text-anchor="middle" fill="#CFD8DC" font-size="4" font-family="sans-serif">UNMANAGED</text>
    </template>
    <!-- Printer -->
    <template v-else-if="type === 'printer'">
      <rect x="3" y="6" width="30" height="18" rx="4" fill="#ECEFF1" stroke="#546E7A" stroke-width="1.5"/>
      <rect x="7" y="9" width="22" height="10" rx="2" fill="#B0BEC5"/>
      <rect x="10" y="12" width="16" height="5" fill="#FAFAFA"/>
      <rect x="2" y="24" width="32" height="4" rx="1.5" fill="#78909C"/>
      <rect x="20" y="30" width="8" height="3" rx="1" fill="#546E7A"/>
      <rect x="24" y="20" width="2" height="4" fill="#546E7A"/>
      <rect x="12" y="20" width="12" height="2" rx="1" fill="#ECEFF1" stroke="#BDBDBD" stroke-width="0.5"/>
    </template>
    <!-- IPS (Intrusion Prevention System) -->
    <template v-else-if="type === 'ips'">
      <rect x="2" y="7" width="32" height="22" rx="4" fill="#AB47BC" stroke="#6A1B9A" stroke-width="1.5"/>
      <rect x="8" y="11" width="20" height="2.5" rx="0.5" fill="#6A1B9A"/>
      <rect x="8" y="15" width="20" height="2.5" rx="0.5" fill="#6A1B9A"/>
      <circle cx="12" cy="23" r="1.5" fill="#4CAF50"/>
      <circle cx="18" cy="23" r="1.5" fill="#FFC107"/>
      <circle cx="24" cy="23" r="1.5" fill="#4CAF50"/>
    </template>
    <!-- Cloud -->
    <template v-else-if="type === 'cloud'">
      <rect x="3" y="10" width="30" height="22" rx="12" fill="#BBDEFB" stroke="#1565C0" stroke-width="1.5"/>
      <rect x="10" y="6" width="16" height="12" rx="6" fill="#E3F2FD" stroke="#90CAF9" stroke-width="1"/>
    </template>
    <!-- Default fallback -->
    <template v-else>
      <rect x="4" y="6" width="28" height="24" rx="4" fill="#90A4AE" stroke="#546E7A" stroke-width="1.5"/>
    </template>
  </svg>
</template>

<script setup>
defineProps({
  type: { type: String, required: true }
})
</script>
