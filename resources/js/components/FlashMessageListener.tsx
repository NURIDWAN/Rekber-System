import { useEffect } from 'react';
import { usePage } from '@inertiajs/react';
import { useToast } from '@/hooks/use-toast';
import { SharedData } from '@/types';

export default function FlashMessageListener() {
    const { props } = usePage<SharedData>();
    const { toast } = useToast();
    const flash = props.flash || {};

    useEffect(() => {
        if (flash.success) {
            toast({
                title: 'Success',
                description: flash.success,
                variant: 'default',
            });
        }

        if (flash.error) {
            toast({
                title: 'Error',
                description: flash.error,
                variant: 'destructive',
            });
        }

        if (flash.warning) {
            toast({
                title: 'Warning',
                description: flash.warning,
                variant: 'default', // You might want a specific warning variant if available, or style it differently
                className: 'bg-yellow-50 border-yellow-200 text-yellow-900',
            });
        }
    }, [flash, toast]);

    return null;
}
