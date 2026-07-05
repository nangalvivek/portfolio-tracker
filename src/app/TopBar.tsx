import BrightnessContrastIcon from '@react-spectrum/s2/icons/BrightnessContrast'
import {useAppTheme} from './theme'
import {BrandMark} from './BrandMark'
import './TopBar.css'

export const TopBar = () => {
  const {colorScheme, toggleColorScheme} = useAppTheme()
  const nextScheme = colorScheme === 'dark' ? 'light' : 'dark'

  return (
    <div className="top-bar">
      <div className="top-bar__inner">
        <div className="top-bar__brand">
          <span className="top-bar__brand-mark" aria-hidden="true">
            <BrandMark />
          </span>
          <span className="top-bar__brand-text">Vitta</span>
        </div>

        <button
          type="button"
          aria-label={`Switch to ${nextScheme} mode`}
          onClick={toggleColorScheme}
          className="top-bar__theme-toggle"
        >
          <BrightnessContrastIcon aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
