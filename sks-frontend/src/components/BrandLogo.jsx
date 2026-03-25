import logo from '../assets/logo.png';

const BrandLogo = ({ className = '' }) => {
  return (
    <img
      src={logo}
      alt="Smart Knowledge System"
      className={`w-full object-contain ${className}`.trim()}
    />
  );
};

export default BrandLogo;
