export const getBentoGridClass = (count: number) => {
  if (count <= 1) return "mx-auto max-w-sm";
  if (count === 2) return "mx-auto sm:grid-cols-2 xl:max-w-4xl";
  if (count === 3) return "mx-auto sm:grid-cols-2 xl:grid-cols-3";
  if (count === 4) return "mx-auto sm:grid-cols-2 xl:grid-cols-2 xl:max-w-4xl";
  return "sm:grid-cols-2 xl:grid-cols-3";
};
