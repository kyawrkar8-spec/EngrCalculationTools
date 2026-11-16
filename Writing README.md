# Solar Sizing — kW Calculator (Sigenergy style)

ရိုးရှင်းသော solar / battery sizing web app။ **Ah, DC bus voltage, DoD, charge controller မပါ** —
အားလုံးကို **kW / kWh** ဖြင့်သာ တွက်သည်။

## Tabs

### 1. System Sizing (kW)
Input — နေ့စဉ် kWh, peak kW, backup နာရီ, peak sun hours, panel W, loss %, AC voltage။

Output
| အချက် | တွက်နည်း |
|---|---|
| PV Array (kWp) | kWh/day ÷ (sun hours × loss) → panel အရေအတွက် |
| Battery (kWh) | (kWh/day ÷ 24) × backup နာရီ → 8 kWh module |
| Inverter (kW) | peak kW × 1.1 → SigenStor rating အနီးဆုံး (3.6…48 kW) |
| Main breaker | peak မှ FLC + 25% margin |
| Transformer | လိုအပ်ပါက kVA standard size |

Manual override ဖြင့် ကိုယ့် datasheet ဂဏန်း (kWp / kWh / kW) ကို တိုက်ရိုက် ထည့်နိုင်သည်။

### 2. Load List
Load တစ်ခုချင်း kW × qty × hours ထည့်ပြီး connected load, peak demand (diversity factor),
daily kWh ကို အလိုအလျောက် ပေါင်းပေးသည်။ "Sizing သို့ ပို့မည်" ဖြင့် တိုက်ရိုက် ပို့နိုင်သည်။

### 3. Calculations
Breaker (A) • Cable size / voltage drop • P·S·Q • PF correction (kVAr) • Transformer (kVA)။

### 4. SLD
Auto-drawn single line diagram (Grid → Main breaker → Bus → Loads, PV/Battery → Inverter → Bus)။
Symbol palette, drag, wire ဆက်ခြင်း, label ပြင်ခြင်း, Save/Load, SVG export ပါဝင်သည်။

## Run
Zero-build plain web app — `index.html` ကို browser တွင် ဖွင့်ရုံပါ။
Files: `index.html`, `style.css`, `app.js`, `sld.js`.
