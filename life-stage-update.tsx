// Replace your current life stage dropdown with this multi-select checkbox component:

const lifeStages = [
  "student", "adult", "parent", "single parent", "entrepreneur", "employee"
];

// Replace the existing <Select label="Life Stage" ... /> section with:
<div className="space-y-2">
  <label className="text-sm font-medium">Life Stages</label>
  <div className="grid grid-cols-2 gap-2">
    {lifeStages.map(stage => (
      <label key={stage} className="flex items-center space-x-2 cursor-pointer">
        <input
          type="checkbox"
          className="rounded border-gray-300"
          checked={formData.life_stage?.includes(stage) || false}
          onChange={(e) => {
            const currentStages = formData.life_stage || [];
            const updatedStages = e.target.checked
              ? [...currentStages, stage]
              : currentStages.filter(s => s !== stage);
            
            setFormData(prev => ({
              ...prev,
              life_stage: updatedStages
            }));
          }}
        />
        <span className="text-sm capitalize">{stage}</span>
      </label>
    ))}
  </div>
</div>

// Make sure your formData state includes life_stage as an array:
const [formData, setFormData] = useState({
  // ... other fields
  life_stage: [], // Initialize as empty array
  // ... other fields
});