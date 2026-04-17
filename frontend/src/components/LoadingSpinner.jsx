export default function LoadingSpinner({ size = 24, style = {} }) {
  return (
    <span
      className="spinner"
      style={{ width: size, height: size, borderWidth: size > 20 ? 3 : 2, ...style }}
      role="status"
      aria-label="Loading"
    />
  );
}
