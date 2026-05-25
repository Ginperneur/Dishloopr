Replace the restaurant `Select` dropdown on the Owner Dashboard with a searchable Combobox using shadcn/ui `Command` + `Popover`.

1. Import `Popover`, `PopoverContent`, `PopoverTrigger` and `Command` subcomponents into `OwnerDashboard.tsx`.
2. Replace the existing `<Select>` block (lines 286-304) with a Combobox pattern:
   - Trigger button showing selected restaurant name + chevron icon
   - Popover containing a `<CommandInput>` search field
   - Filtered `<CommandItem>` list that updates as the user types
   - `Check` icon on the selected item
3. Keep existing `onValueChange` behavior: update `selectedRestaurant` via `setSelectedRestaurant`.
4. Maintain the `restaurants.length > 1` guard so the selector only appears when multiple restaurants exist.

No backend or data changes needed — purely UI.