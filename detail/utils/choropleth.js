/* ===================================================================
   World.One 1.0 -- Reusable SVG Choropleth Component (INFRA-06)
   Extracted from temperature.js pattern, parameterized for any data map.
   Renders colored SVG world map with tooltip and legend.
   =================================================================== */

import { DOMUtils } from '../../js/utils/dom.js';

// --- Country class/name -> ISO-2 mapping (covers SVG paths using class or name attributes) ---

const CLASS_TO_ISO = {
  'Afghanistan': 'AF', 'Albania': 'AL', 'Algeria': 'DZ', 'Angola': 'AO',
  'Argentina': 'AR', 'Armenia': 'AM', 'Australia': 'AU', 'Austria': 'AT',
  'Azerbaijan': 'AZ', 'Bangladesh': 'BD', 'Belarus': 'BY', 'Belgium': 'BE',
  'Benin': 'BJ', 'Bolivia': 'BO', 'Bosnia and Herzegovina': 'BA', 'Botswana': 'BW',
  'Brazil': 'BR', 'Bulgaria': 'BG', 'Burkina Faso': 'BF', 'Burundi': 'BI',
  'Cambodia': 'KH', 'Cameroon': 'CM', 'Canada': 'CA', 'Central African Republic': 'CF',
  'Chad': 'TD', 'Chile': 'CL', 'China': 'CN', 'Colombia': 'CO',
  'Congo': 'CG', 'Croatia': 'HR', 'Cuba': 'CU', 'Czech Republic': 'CZ',
  'Czechia': 'CZ', 'DR Congo': 'CD',
  'Democratic Republic of the Congo': 'CD', 'Denmark': 'DK',
  'Dominican Republic': 'DO', 'Ecuador': 'EC', 'Egypt': 'EG',
  'El Salvador': 'SV', 'Equatorial Guinea': 'GQ', 'Eritrea': 'ER',
  'Estonia': 'EE', 'Ethiopia': 'ET', 'Finland': 'FI', 'France': 'FR',
  'Gabon': 'GA', 'Georgia': 'GE', 'Germany': 'DE', 'Ghana': 'GH',
  'Greece': 'GR', 'Greenland': 'GL', 'Guatemala': 'GT', 'Guinea': 'GN',
  'Guyana': 'GY', 'Haiti': 'HT', 'Honduras': 'HN', 'Hungary': 'HU',
  'Iceland': 'IS', 'India': 'IN', 'Indonesia': 'ID', 'Iran': 'IR',
  'Iraq': 'IQ', 'Ireland': 'IE', 'Israel': 'IL', 'Italy': 'IT',
  'Jamaica': 'JM', 'Japan': 'JP', 'Jordan': 'JO', 'Kazakhstan': 'KZ',
  'Kenya': 'KE', 'Kuwait': 'KW', 'Kyrgyzstan': 'KG', 'Laos': 'LA',
  'Latvia': 'LV', 'Lebanon': 'LB', 'Libya': 'LY', 'Lithuania': 'LT',
  'Madagascar': 'MG', 'Malawi': 'MW', 'Malaysia': 'MY', 'Mali': 'ML',
  'Mauritania': 'MR', 'Mexico': 'MX', 'Moldova': 'MD', 'Mongolia': 'MN',
  'Morocco': 'MA', 'Mozambique': 'MZ', 'Myanmar': 'MM', 'Namibia': 'NA',
  'Nepal': 'NP', 'Netherlands': 'NL', 'New Zealand': 'NZ', 'Nicaragua': 'NI',
  'Niger': 'NE', 'Nigeria': 'NG', 'North Korea': 'KP', 'Norway': 'NO',
  'Oman': 'OM', 'Pakistan': 'PK', 'Panama': 'PA', 'Papua New Guinea': 'PG',
  'Paraguay': 'PY', 'Peru': 'PE', 'Philippines': 'PH', 'Poland': 'PL',
  'Portugal': 'PT', 'Qatar': 'QA', 'Romania': 'RO', 'Russia': 'RU',
  'Rwanda': 'RW', 'Saudi Arabia': 'SA', 'Senegal': 'SN', 'Serbia': 'RS',
  'Sierra Leone': 'SL', 'Slovakia': 'SK', 'Slovenia': 'SI', 'Somalia': 'SO',
  'South Africa': 'ZA', 'South Korea': 'KR', 'Spain': 'ES', 'Sri Lanka': 'LK',
  'Sudan': 'SD', 'Suriname': 'SR', 'Sweden': 'SE', 'Switzerland': 'CH',
  'Syria': 'SY', 'Taiwan': 'TW', 'Tajikistan': 'TJ', 'Tanzania': 'TZ',
  'Thailand': 'TH', 'Togo': 'TG', 'Tunisia': 'TN', 'Turkey': 'TR',
  'Turkmenistan': 'TM', 'Uganda': 'UG', 'Ukraine': 'UA',
  'United Arab Emirates': 'AE', 'United Kingdom': 'GB', 'United States': 'US',
  'Uruguay': 'UY', 'Uzbekistan': 'UZ', 'Venezuela': 'VE', 'Vietnam': 'VN',
  'Yemen': 'YE', 'Zambia': 'ZM', 'Zimbabwe': 'ZW',
  // Additional multi-part countries from maps.js
  'Bahamas': 'BS', 'Cape Verde': 'CV', 'Comoros': 'KM', 'Cyprus': 'CY',
  'Falkland Islands': 'FK', 'Fiji': 'FJ', 'Malta': 'MT',
  'New Caledonia': 'NC', 'Russian Federation': 'RU',
  'Solomon Islands': 'SB', 'Vanuatu': 'VU', 'Seychelles': 'SC',
  'Mauritius': 'MU', 'Samoa': 'WS', 'Trinidad and Tobago': 'TT', 'Tonga': 'TO',
};

// --- Glass-morphism tooltip style ---

const TOOLTIP_STYLE = {
  position: 'absolute',
  background: 'rgba(18,18,26,0.9)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '8px',
  padding: '8px 12px',
  color: 'var(--text-primary)',
  fontSize: '0.8rem',
  pointerEvents: 'none',
  zIndex: '1000',
  whiteSpace: 'nowrap',
  transition: 'opacity 0.15s ease',
};

/**
 * Render a reusable SVG choropleth map into a container element.
 * @param {HTMLElement} container - Parent element to append map into
 * @param {Object} options
 * @param {Object} options.dataMap - ISO-2 code -> numeric value mapping
 * @param {Function} options.colorFn - (value) => CSS color string
 * @param {Function} options.tooltipFn - (iso, value) => tooltip text
 * @param {Array} options.legendItems - [{color, label}] for discrete legend swatches
 * @param {string} [options.title] - Optional heading text above the map
 * @param {string} [options.defaultColor] - Color for countries with no data
 * @returns {Promise<{wrapper: HTMLElement, cleanup: Function}>}
 */
export async function renderChoropleth(container, options) {
  const {
    dataMap,
    colorFn,
    tooltipFn,
    legendItems,
    title,
    defaultColor = 'rgba(255,255,255,0.05)',
  } = options;

  // Optional title heading
  if (title) {
    container.appendChild(
      DOMUtils.create('h2', {
        textContent: title,
        style: { color: 'var(--text-primary)', margin: '0 0 var(--space-sm)' },
      })
    );
  }

  // Fetch world.svg
  const basePath = window.location.pathname.includes('/detail') ? '../' : '';
  let svgText = null;
  try {
    const response = await fetch(`${basePath}assets/maps/world.svg`);
    if (response.ok) {
      svgText = await response.text();
    }
  } catch (_err) {
    // Fallback handled below
  }

  if (!svgText) {
    container.appendChild(
      DOMUtils.create('p', {
        textContent: 'Map unavailable',
        style: { color: 'var(--text-secondary)', fontStyle: 'italic' },
      })
    );
    return { wrapper: null, cleanup: () => {} };
  }

  // SVG wrapper
  const wrapper = DOMUtils.create('div', {
    className: 'choropleth-wrapper',
    style: {
      position: 'relative',
      borderRadius: '12px',
      overflow: 'hidden',
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(255,255,255,0.06)',
      marginBottom: 'var(--space-sm)',
    },
  });

  // Inject SVG
  wrapper.innerHTML = svgText;

  // Style the SVG element
  const svgEl = wrapper.querySelector('svg');
  if (svgEl) {
    svgEl.style.width = '100%';
    svgEl.style.height = 'auto';
    svgEl.style.display = 'block';
    svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svgEl.style.background = 'transparent';
    svgEl.removeAttribute('fill');
    svgEl.removeAttribute('stroke');
    svgEl.removeAttribute('stroke-width');
    svgEl.removeAttribute('stroke-linecap');
    svgEl.removeAttribute('stroke-linejoin');
  }

  // Create tooltip element
  const tooltipEl = DOMUtils.create('div', {
    className: 'choropleth-tooltip',
    style: { ...TOOLTIP_STYLE, opacity: '0' },
  });
  wrapper.appendChild(tooltipEl);

  // Track event listeners for cleanup
  const listeners = [];

  function addListener(el, event, handler) {
    el.addEventListener(event, handler);
    listeners.push({ el, event, handler });
  }

  // Color country paths
  const paths = wrapper.querySelectorAll('path');
  for (const path of paths) {
    // Extract ISO-2 from id, class, or name
    let iso = null;

    // Try id first (2-letter ISO codes)
    const pathId = path.getAttribute('id');
    if (pathId && pathId.length === 2) {
      iso = pathId;
    }

    // Try class name mapping
    if (!iso) {
      const className = path.getAttribute('class');
      if (className && CLASS_TO_ISO[className]) {
        iso = CLASS_TO_ISO[className];
      }
    }

    // Try name attribute
    if (!iso) {
      const nameAttr = path.getAttribute('name');
      if (nameAttr && CLASS_TO_ISO[nameAttr]) {
        iso = CLASS_TO_ISO[nameAttr];
      }
    }

    const value = iso ? dataMap[iso] : undefined;

    if (value !== undefined) {
      path.style.fill = colorFn(value);
      path.style.opacity = '0.85';
      path.style.stroke = 'rgba(255,255,255,0.15)';
      path.style.strokeWidth = '0.3';
      path.style.cursor = 'pointer';
      path.style.transition = 'opacity 0.15s ease';

      // Mouse handlers
      addListener(path, 'mouseenter', () => {
        path.style.opacity = '1';
        path.style.filter = 'brightness(1.2)';
        tooltipEl.textContent = tooltipFn(iso, value);
        tooltipEl.style.opacity = '1';
      });

      addListener(path, 'mousemove', (e) => {
        const wrapperRect = wrapper.getBoundingClientRect();
        let left = e.clientX - wrapperRect.left + 12;
        let top = e.clientY - wrapperRect.top - 30;
        // Boundary clamping
        if (left + 150 > wrapperRect.width) left = left - 160;
        if (top < 0) top = 10;
        tooltipEl.style.left = left + 'px';
        tooltipEl.style.top = top + 'px';
      });

      addListener(path, 'mouseleave', () => {
        path.style.opacity = '0.85';
        path.style.filter = '';
        tooltipEl.style.opacity = '0';
      });
    } else {
      // No data -- dim styling
      path.style.fill = defaultColor;
      path.style.opacity = '0.3';
      path.style.stroke = 'rgba(255,255,255,0.05)';
      path.style.strokeWidth = '0.2';
    }
  }

  container.appendChild(wrapper);

  // Legend: horizontal flex row of color swatches
  if (legendItems && legendItems.length > 0) {
    const swatches = legendItems.map(({ color, label }) =>
      DOMUtils.create('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        },
      }, [
        DOMUtils.create('div', {
          style: {
            width: '14px',
            height: '14px',
            borderRadius: '3px',
            background: color,
            flexShrink: '0',
          },
        }),
        DOMUtils.create('span', {
          textContent: label,
          style: { fontSize: '0.7rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' },
        }),
      ])
    );

    container.appendChild(
      DOMUtils.create('div', {
        style: {
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--space-xs)',
          justifyContent: 'center',
          marginTop: 'var(--space-xs)',
        },
      }, swatches)
    );
  }

  // Cleanup function removes all tracked event listeners
  function cleanup() {
    listeners.forEach(({ el, event, handler }) => {
      el.removeEventListener(event, handler);
    });
    listeners.length = 0;
  }

  return { wrapper, cleanup };
}
