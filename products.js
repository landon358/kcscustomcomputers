// Static product catalogue.
//
// This is the fallback AND the source of presentation detail. When Shopify is
// configured, shopify.js merges live commerce data (price, stock, variant ID,
// images) over these entries, matching Shopify's product `handle` to `id`
// below — so keep the handles in Shopify identical to these ids.
//
// Everything Shopify does not model well — specs, fps benchmarks, tagline —
// keeps living here.
window.PRODUCTS_STATIC = [
  {
    id: 'prime-s', name: 'Prime S', kind: 'prime', price: 1300, inStock: true,
    images: ['images/prime-s.jpg', 'images/hero-01-white-openframe.jpg'],
    tagline: 'The entry point that still plays everything at 1080p high.',
    specs: [['CPU', 'Ryzen 5 7600X · 6C/12T'], ['Cooler', '360mm AIO'], ['GPU', 'RTX 5060 8GB'], ['Memory', '16GB DDR5-6000'], ['Storage', '1TB NVMe SSD'], ['Power', '700W 80+ Bronze'], ['Case', 'Airflow mid tower, glass side'], ['OS', 'Windows 11 Pro']],
    fps: [['Fortnite', 165], ['CS2', 240], ['Warzone', 130]]
  },
  {
    id: 'prime-s-pro', name: 'Prime S Pro', kind: 'prime', price: 1400, inStock: true,
    images: ['images/prime-s-pro.jpg', 'images/hero-02-white-matx.jpg'],
    tagline: 'Same chassis, a meaningfully faster card.',
    specs: [['CPU', 'Ryzen 5 7600X · 6C/12T'], ['Cooler', '360mm AIO'], ['GPU', 'RTX 5060 Ti 8GB'], ['Memory', '16GB DDR5-6000'], ['Storage', '1TB NVMe SSD'], ['Power', '700W 80+ Bronze'], ['Case', 'Airflow mid tower, glass side'], ['OS', 'Windows 11 Pro']],
    fps: [['Fortnite', 185], ['CS2', 265], ['Warzone', 148]]
  },
  {
    id: 'prime-m', name: 'Prime M', kind: 'prime', price: 1900, inStock: true, popular: true,
    images: ['images/prime-m-01.jpg', 'images/prime-m-02.jpg'],
    tagline: 'The one most people should buy.',
    specs: [['CPU', 'Ryzen 7 7700X · 8C/16T'], ['Cooler', '360mm AIO'], ['GPU', 'RTX 5070 12GB'], ['Memory', '32GB DDR5-6000'], ['Storage', '1TB NVMe SSD'], ['Power', '850W 80+ Gold'], ['Case', 'Airflow mid tower, glass side'], ['OS', 'Windows 11 Pro']],
    fps: [['Fortnite', 215], ['CS2', 300], ['Warzone', 172]]
  },
  {
    id: 'prime-m-pro', name: 'Prime M Pro', kind: 'prime', price: 2000, inStock: false,
    stockNote: 'Next batch mid-August',
    images: ['images/prime-m-02.jpg', 'images/prime-m-01.jpg'],
    tagline: 'The X3D chip, without the X-class card.',
    specs: [['CPU', 'Ryzen 7 7800X3D · 8C/16T'], ['Cooler', '360mm AIO'], ['GPU', 'RTX 5070 12GB'], ['Memory', '32GB DDR5-6000'], ['Storage', '1TB NVMe SSD'], ['Power', '850W 80+ Gold'], ['Case', 'Airflow mid tower, glass side'], ['OS', 'Windows 11 Pro']],
    fps: [['Fortnite', 240], ['CS2', 335], ['Warzone', 188]]
  },
  {
    id: 'prime-x', name: 'Prime X', kind: 'prime', price: 2550, inStock: true,
    images: ['images/prime-x.jpg', 'images/prime-x-02.jpg'],
    tagline: 'Top of the range, built to stay there.',
    specs: [['CPU', 'Ryzen 7 7800X3D · 8C/16T'], ['Cooler', '360mm AIO'], ['GPU', 'RTX 5070 Ti 16GB'], ['Memory', '32GB DDR5-6000'], ['Storage', '1TB NVMe SSD'], ['Power', '850W 80+ Gold'], ['Case', 'Airflow mid tower, glass side'], ['OS', 'Windows 11 Pro']],
    fps: [['Fortnite', 265], ['CS2', 370], ['Warzone', 205]]
  },
  {
    id: 'deal-850', name: 'Ryzen 5 5600X · RTX 4060', kind: 'deal', price: 850, inStock: true,
    images: ['images/deal-850-5600x-4060.jpg'],
    tagline: 'One of one. When it is gone, it is gone.',
    specs: [['CPU', 'Ryzen 5 5600X · 6C/12T'], ['Cooler', 'Air tower'], ['GPU', 'RTX 4060 8GB'], ['Memory', '16GB DDR4-3600'], ['Storage', '512GB NVMe SSD'], ['Power', '650W 80+ Bronze'], ['Case', 'Lian Li V100R'], ['OS', 'Windows 11 Pro']],
    fps: [['Fortnite', 145], ['CS2', 210], ['Warzone', 118]]
  },
  {
    id: 'deal-1150', name: 'Ryzen 5 7500X3D · RTX 4060', kind: 'deal', price: 1150, inStock: true,
    images: ['images/deal-1150-7500x3d-4060.jpg'],
    tagline: 'One of one. When it is gone, it is gone.',
    specs: [['CPU', 'Ryzen 5 7500X3D · 6C/12T'], ['Cooler', '360mm AIO'], ['GPU', 'RTX 4060 8GB'], ['Memory', '32GB DDR4-3600'], ['Storage', '1TB NVMe SSD'], ['Power', '750W 80+ Gold'], ['Case', 'Airflow mid tower'], ['OS', 'Windows 11 Pro']],
    fps: [['Fortnite', 168], ['CS2', 255], ['Warzone', 132]]
  },
  {
    id: 'deal-1350', name: 'Ryzen 5 7500X3D · RTX 3080', kind: 'deal', price: 1350, inStock: false,
    stockNote: 'Sold — one of one',
    images: ['images/deal-1350-7500x3d-3080.jpg'],
    tagline: 'One of one. When it is gone, it is gone.',
    specs: [['CPU', 'Ryzen 5 7500X3D · 6C/12T'], ['Cooler', '360mm AIO'], ['GPU', 'RTX 3080 10GB'], ['Memory', '16GB DDR5-6000'], ['Storage', '1TB NVMe SSD'], ['Power', '850W 80+ Gold'], ['Case', 'Lian Li V100'], ['OS', 'Windows 11 Pro']],
    fps: [['Fortnite', 195], ['CS2', 280], ['Warzone', 160]]
  },
  {
    id: 'deal-2100', name: 'Ryzen 7 7800X3D · RTX 5070', kind: 'deal', price: 2100, inStock: true,
    images: ['images/deal-2100-7800x3d-5070.jpg'],
    tagline: 'One of one. When it is gone, it is gone.',
    specs: [['CPU', 'Ryzen 7 7800X3D · 8C/16T'], ['Cooler', '360mm AIO'], ['GPU', 'RTX 5070 12GB'], ['Memory', '32GB DDR5-6000 RGB'], ['Storage', '1TB NVMe SSD'], ['Power', '850W 80+ Gold'], ['Case', 'Lian Li V100'], ['OS', 'Windows 11 Pro']],
    fps: [['Fortnite', 240], ['CS2', 330], ['Warzone', 190]]
  }
];

// Live catalogue. Starts as the static list so synchronous page code keeps
// working, then gets replaced in place once Shopify responds.
window.PRODUCTS = window.PRODUCTS_STATIC.slice();

window.byId = function (id) { return window.PRODUCTS.find(function (p) { return p.id === id; }) || window.PRODUCTS[2]; };
window.money = function (n) { return '$' + Math.round(n).toLocaleString('en-US'); };
