import { ShippingOption } from '@/types';

export class ShippingService {
  static calculateShipping(postalCode: string, subtotal: number): ShippingOption[] {
    const cleanCep = postalCode.replace(/\D/g, '');
    if (cleanCep.length !== 8) {
      throw new Error('CEP invalido');
    }

    const isSP = cleanCep.startsWith('01') || cleanCep.startsWith('02') || cleanCep.startsWith('03') || cleanCep.startsWith('04') || cleanCep.startsWith('05') || cleanCep.startsWith('08');
    const isSudeste = cleanCep.startsWith('0') || cleanCep.startsWith('1') || cleanCep.startsWith('2') || cleanCep.startsWith('3');

    if (subtotal >= 299) {
      return [
        {
          carrier: 'Focus Express',
          serviceName: 'Frete Gr?tis Especial',
          price: 0,
          estimatedDays: isSP ? 2 : (isSudeste ? 4 : 7),
        },
        {
          carrier: 'Correios SEDEX',
          serviceName: 'SEDEX Turbo',
          price: isSP ? 14.90 : 28.90,
          estimatedDays: isSP ? 1 : 2,
        },
      ];
    }

    if (isSP) {
      return [
        {
          carrier: 'Focus Express',
          serviceName: 'Standard SP',
          price: 12.90,
          estimatedDays: 2,
        },
        {
          carrier: 'Correios SEDEX',
          serviceName: 'SEDEX Express',
          price: 18.50,
          estimatedDays: 1,
        },
      ];
    }

    if (isSudeste) {
      return [
        {
          carrier: 'Focus Express',
          serviceName: 'PAC Econ?mico',
          price: 22.90,
          estimatedDays: 5,
        },
        {
          carrier: 'Correios SEDEX',
          serviceName: 'SEDEX Sudeste',
          price: 34.90,
          estimatedDays: 2,
        },
      ];
    }

    return [
      {
        carrier: 'Focus Express',
        serviceName: 'PAC Brasil',
        price: 29.90,
        estimatedDays: 8,
      },
      {
        carrier: 'Correios SEDEX',
        serviceName: 'SEDEX Nacional',
        price: 49.90,
        estimatedDays: 3,
      },
    ];
  }
}
