// Configurator catalogue. Options mirror KC's current Shopify quote form.
// `note` is the plain-language line shown under each option in the picker.

var P = 'images/components/';

window.CATEGORIES = [
  {
    id: 'cpu', label: 'Processor', short: 'CPU',
    blurb: 'The chip that runs everything. For gaming, cache matters more than core count.',
    options: [
      { id: 'i5-12600k',   name: 'Intel Core i5-12600K',    brand: 'Intel', note: '10 cores / 16 threads · 4.9GHz boost',        img: P + 'cpu-intel-core-i5-12600k.jpg' },
      { id: 'i7-12700k',   name: 'Intel Core i7-12700K',    brand: 'Intel', note: '12 cores / 20 threads · 5.0GHz boost',     img: P + 'cpu-intel-core-i7-12700k.jpg' },
      { id: 'r5-7600x',    name: 'AMD Ryzen 5 7600X',       brand: 'AMD',   note: '6 cores / 12 threads · 5.3GHz boost',  img: P + 'cpu-amd-ryzen-5-7600x.png' },
      { id: 'r5-9600x',    name: 'AMD Ryzen 5 9600X',       brand: 'AMD',   note: '6 cores / 12 threads · 5.4GHz boost',  img: P + 'cpu-amd-ryzen-5-9600x.png' },
      { id: 'i9-12900k',   name: 'Intel Core i9-12900K',    brand: 'Intel', note: '16 cores / 24 threads · 5.2GHz boost', img: P + 'cpu-intel-core-i9-12900k.png' },
      { id: 'i7-14700k',   name: 'Intel Core i7-14700K',    brand: 'Intel', note: '20 cores / 28 threads · 5.6GHz boost', img: P + 'cpu-intel-core-i7-14700k.jpg' },
      { id: 'r5-7600x3d',  name: 'AMD Ryzen 5 7600X3D',     brand: 'AMD',   note: '6 cores / 12 threads · 96MB 3D cache', img: P + 'cpu-amd-ryzen-5-7600x3d.jpg' },
      { id: 'r7-7700x',    name: 'AMD Ryzen 7 7700X',       brand: 'AMD',   note: '8 cores / 16 threads · 5.4GHz boost',    img: P + 'cpu-amd-ryzen-7-7700x.png' },
      { id: 'r7-9700x',    name: 'AMD Ryzen 7 9700X',       brand: 'AMD',   note: '8 cores / 16 threads · 5.5GHz boost',    img: P + 'cpu-amd-ryzen-7-9700x.png' },
      { id: 'u7-265k',     name: 'Intel Core Ultra 7 265K', brand: 'Intel', note: '20 cores / 20 threads · 5.5GHz boost',       img: P + 'cpu-intel-core-ultra-7-265k.jpg' },
      { id: 'i9-14900k',   name: 'Intel Core i9-14900K',    brand: 'Intel', note: '24 cores / 32 threads · 6.0GHz boost',  img: P + 'cpu-intel-core-i9-14900k.jpg' },
      { id: 'r7-7800x3d',  name: 'AMD Ryzen 7 7800X3D',     brand: 'AMD',   note: '8 cores / 16 threads · 104MB 3D cache',        img: P + 'cpu-amd-ryzen-7-7800x3d.png' },
      { id: 'r9-9900x',    name: 'AMD Ryzen 9 9900X',       brand: 'AMD',   note: '12 cores / 24 threads · 5.6GHz boost',      img: P + 'cpu-amd-ryzen-9-9900x.png' },
      { id: 'r7-9800x3d',  name: 'AMD Ryzen 7 9800X3D',     brand: 'AMD',   note: '8 cores / 16 threads · 104MB 3D cache',      img: P + 'cpu-amd-ryzen-7-9800x3d.png' },
      { id: 'u9-285k',     name: 'Intel Core Ultra 9 285K', brand: 'Intel', note: '24 cores / 24 threads · 5.7GHz boost',     img: P + 'cpu-intel-core-ultra-9-285k.jpg' },
      { id: 'r9-9950x',    name: 'AMD Ryzen 9 9950X',       brand: 'AMD',   note: '16 cores / 32 threads · 5.7GHz boost',    img: P + 'cpu-amd-ryzen-9-9950x.png' },
      { id: 'r9-9950x3d',  name: 'AMD Ryzen 9 9950X3D',     brand: 'AMD',   note: '16 cores / 32 threads · 144MB 3D cache', img: P + 'cpu-amd-ryzen-9-9950x3d.png' }
    ]
  },
  {
    id: 'cooler', label: 'CPU Cooler', short: 'Cooling',
    blurb: 'Bigger radiators run quieter at the same temperature. Check your case clearance.',
    options: [
      { id: 'air',    name: 'Tower Air Cooler',      note: '165mm tower · 1 × 140mm fan', img: P + 'cooler-tower-air.jpg' },
      { id: 'aio240', name: '240mm AIO Liquid',      note: '240mm radiator · 2 × 120mm fans',           img: P + 'cooler-aio-240mm.jpg' },
      { id: 'aio280', name: '280mm AIO Liquid',      note: '280mm radiator · 2 × 140mm fans',         img: P + 'cooler-aio-280mm.jpg' },
      { id: 'aio360', name: '360mm AIO Liquid',      note: '360mm radiator · 3 × 120mm fans',       img: P + 'cooler-aio-360mm.jpg' },
      { id: 'aio420', name: '420mm AIO Liquid',      note: '420mm radiator · 3 × 140mm fans',   img: P + 'cooler-aio-420mm.jpg' }
    ]
  },
  {
    id: 'gpu', label: 'Graphics Card', short: 'GPU',
    blurb: 'The single biggest factor in frame rate. Spec it to the resolution you actually play at.',
    options: [
      { id: 'rtx5050',    name: 'NVIDIA RTX 5050 8GB',     brand: 'NVIDIA', note: '8GB GDDR6 · 128-bit',        img: P + 'gpu-nvidia-rtx-5050-8gb.jpg' },
      { id: 'rtx5060',    name: 'NVIDIA RTX 5060 8GB',     brand: 'NVIDIA', note: '8GB GDDR7 · 128-bit',        img: P + 'gpu-nvidia-rtx-5060-8gb.jpg' },
      { id: 'arcb580',    name: 'Intel ARC B580 12GB',     brand: 'Intel',  note: '12GB GDDR6 · 192-bit',   img: P + 'gpu-intel-arc-b580-12gb.jpg' },
      { id: 'rx9060xt',   name: 'AMD RX 9060 XT 8GB',      brand: 'AMD',    note: '8GB GDDR6 · 128-bit',           img: P + 'gpu-amd-rx-9060xt-8gb.png' },
      { id: 'rtx5060ti8', name: 'NVIDIA RTX 5060 Ti 8GB',  brand: 'NVIDIA', note: '8GB GDDR7 · 128-bit',                img: P + 'gpu-nvidia-rtx-5060ti-8gb.jpg' },
      { id: 'rtx5060ti16',name: 'NVIDIA RTX 5060 Ti 16GB', brand: 'NVIDIA', note: '16GB GDDR7 · 128-bit',     img: P + 'gpu-nvidia-rtx-5060ti-16gb.jpg' },
      { id: 'rtx5070',    name: 'NVIDIA RTX 5070 12GB',    brand: 'NVIDIA', note: '12GB GDDR7 · 192-bit',         img: P + 'gpu-nvidia-rtx-5070-12gb.jpg' },
      { id: 'rx7900xt',   name: 'AMD RX 7900 XT 20GB',     brand: 'AMD',    note: '20GB GDDR6 · 320-bit',           img: P + 'gpu-amd-rx-7900xt-20gb.png' },
      { id: 'rx9070',     name: 'AMD RX 9070 16GB',        brand: 'AMD',    note: '16GB GDDR6 · 256-bit',   img: P + 'gpu-amd-rx-9070-16gb.png' },
      { id: 'rx9070xt',   name: 'AMD RX 9070 XT 16GB',     brand: 'AMD',    note: '16GB GDDR6 · 256-bit',      img: P + 'gpu-amd-rx-9070xt-16gb.png' },
      { id: 'rtx5070ti',  name: 'NVIDIA RTX 5070 Ti 16GB', brand: 'NVIDIA', note: '16GB GDDR7 · 256-bit', img: P + 'gpu-nvidia-rtx-5070ti-16gb.jpg' },
      { id: 'rtx5080',    name: 'NVIDIA RTX 5080 16GB',    brand: 'NVIDIA', note: '16GB GDDR7 · 256-bit',        img: P + 'gpu-nvidia-rtx-5080-16gb.jpg' },
      { id: 'rx7900xtx',  name: 'AMD RX 7900 XTX 24GB',    brand: 'AMD',    note: '24GB GDDR6 · 384-bit',   img: P + 'gpu-amd-rx-7900xtx-24gb.png' },
      { id: 'rtx5090',    name: 'NVIDIA RTX 5090 32GB',    brand: 'NVIDIA', note: '32GB GDDR7 · 512-bit',      img: P + 'gpu-nvidia-rtx-5090-32gb.jpg' }
    ]
  },
  {
    id: 'ram', label: 'Memory', short: 'RAM',
    blurb: '32GB is the sweet spot for gaming today. More only helps heavy creative work.',
    options: [
      { id: 'ram16',  name: '16GB',  note: '2 × 8GB DDR5-6000',        img: P + 'ram-16gb.webp' },
      { id: 'ram32',  name: '32GB',  note: '2 × 16GB DDR5-6000', img: P + 'ram-32gb.webp' },
      { id: 'ram64',  name: '64GB',  note: '2 × 32GB DDR5-6000',img: P + 'ram-64gb.webp' },
      { id: 'ram128', name: '128GB', note: '4 × 32GB DDR5-5600',   img: P + 'ram-128gb.webp' },
      { id: 'ram256', name: '256GB', note: '4 × 64GB DDR5-5600',    img: P + 'ram-256gb.webp' }
    ]
  },
  {
    id: 'storage', label: 'Storage', short: 'Storage',
    blurb: 'All NVMe, no spinning disks. Modern games run 80–150GB each.',
    options: [
      { id: 'ssd500', name: '500GB NVMe SSD', note: 'PCIe 4.0 · up to 7,250 MB/s', img: P + 'ssd-500gb-nvme.png' },
      { id: 'ssd1',   name: '1TB NVMe SSD',   note: 'PCIe 4.0 · up to 7,300 MB/s',      img: P + 'ssd-1tb-nvme.png' },
      { id: 'ssd2',   name: '2TB NVMe SSD',   note: 'PCIe 4.0 · up to 7,300 MB/s',img: P + 'ssd-2tb-nvme.png' },
      { id: 'ssd4',   name: '4TB NVMe SSD',   note: 'PCIe 4.0 · up to 7,200 MB/s', img: P + 'ssd-4tb-nvme.png' },
      { id: 'ssd8',   name: '8TB NVMe SSD',   note: 'PCIe 4.0 · up to 7,200 MB/s',      img: P + 'ssd-8tb-nvme.png' }
    ]
  },
  {
    id: 'case', label: 'Case', short: 'Case', freeText: true,
    blurb: "Pick one of the chassis we stock, or describe the look you want and we'll confirm it fits your parts.",
    placeholder: 'e.g. white mid tower with a glass side panel, or a specific model you have in mind',
    options: [
      { id: 'case-black-rgb',  name: 'Lian Li Vector V100',       note: 'Mid tower · 4 × ARGB fans · glass side', img: P + 'case-black-rgb-tower.png' },
      { id: 'case-black-pano', name: 'Montech XR ATX Mid Tower',  note: 'Panoramic glass · 3 × ARGB fans',        img: P + 'case-black-panoramic.png' },
      { id: 'case-white-pano', name: 'Lian Li Vector V100 White', note: 'Mid tower · 4 × ARGB fans · front USB-C', img: P + 'case-white-panoramic.png' }
    ]
  }
];