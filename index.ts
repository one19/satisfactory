// import * as pulumi from '@pulumi/pulumi';
import * as aws from '@pulumi/aws';
import * as awsx from '@pulumi/awsx';

// const VPCID = 'vpc-c63229a1';
const subnetIds = ['subnet-bde023db', 'subnet-a654a9ee', 'subnet-9b9eecc3'];

const sg = new awsx.ec2.SecurityGroup('satisfactory-security-group');
awsx.ec2.SecurityGroupRule.ingress(
  'satisfactory-7777',
  sg,
  new awsx.ec2.AnyIPv4Location(),
  new awsx.ec2.UdpPorts(7777),
  'allow satisfactory 7777'
);
awsx.ec2.SecurityGroupRule.ingress(
  'satisfactory-15000',
  sg,
  new awsx.ec2.AnyIPv4Location(),
  new awsx.ec2.UdpPorts(15000),
  'allow satisfactory 15000'
);
awsx.ec2.SecurityGroupRule.ingress(
  'satisfactory-15777',
  sg,
  new awsx.ec2.AnyIPv4Location(),
  new awsx.ec2.UdpPorts(15777),
  'allow satisfactory 15777'
);
awsx.ec2.SecurityGroupRule.egress(
  'all',
  sg,
  new awsx.ec2.AnyIPv4Location(),
  new awsx.ec2.AllTraffic(),
  'allow all'
);

const cluster = new awsx.ecs.Cluster('satisfactory-cluster', { securityGroups: [sg] });
cluster.createAutoScalingGroup('satisfactory-group', {
  subnetIds,
  templateParameters: { minSize: 1 },
  launchConfigurationArgs: { instanceType: 't2.large', imageId: 'ami-0ea87b9ed0e286f93' },
});

// still failing healthchecks; are these the problem???
const nlb = new awsx.lb.NetworkLoadBalancer('satisfactory-nlb', { external: true });

const target7777 = nlb.createTargetGroup('satisfactory-7777', {
  port: 7777,
  protocol: 'UDP',
});
const listener7777 = target7777.createListener('satisfactory-7777', {
  port: 7777,
  protocol: 'UDP',
});

const target15000 = nlb.createTargetGroup('satisfactory-15000', {
  port: 15000,
  protocol: 'UDP',
});
const listener15000 = target15000.createListener('satisfactory-15000', {
  port: 15000,
  protocol: 'UDP',
});

const target15777 = nlb.createTargetGroup('satisfactory-15777', {
  port: 15777,
  protocol: 'UDP',
});
const listener15777 = target15777.createListener('satisfactory-15777', {
  port: 15777,
  protocol: 'UDP',
});

const efsFs = new aws.efs.FileSystem('satisfactory-volume', {
  availabilityZoneName: 'ap-southeast-2a',
  encrypted: false,
  tags: {
    Name: 'satisfactory-config-fs',
  },
});

// new aws.ec2.Instance('satisfactory-large', {
//   ami: 'amzn2-ami-kernel-5.10-hvm-2.0.20211201.0-x86_64-gp2',
//   instanceType: 't2.large',
//   vpcSecurityGroupIds: [sg.id],
// });

new awsx.ecs.EC2Service('satisfactory', {
  cluster,
  desiredCount: 1,
  loadBalancers: [
    {
      targetGroupArn: target7777.targetGroup.arn,
      containerName: 'satisfactory',
      containerPort: 7777,
    },
    {
      targetGroupArn: target15000.targetGroup.arn,
      containerName: 'satisfactory',
      containerPort: 15000,
    },
    {
      targetGroupArn: target15777.targetGroup.arn,
      containerName: 'satisfactory',
      containerPort: 15777,
    },
  ],
  taskDefinitionArgs: {
    volumes: [
      {
        name: 'service-storage',
        dockerVolumeConfiguration: {
          scope: 'shared',
          autoprovision: true,
          driver: 'local',
          driverOpts: {
            type: 'nfs',
            device: `${efsFs.dnsName}:/`,
            o: `addr=${efsFs.dnsName},rsize=1048576,wsize=1048576,hard,timeo=600,retrans=2,noresvport`,
          },
        },
      },
    ],
    containers: {
      satisfactory: {
        image: 'wolveix/satisfactory-server:latest',
        memory: 7000,
        // healthCheck: {
        //   startPeriod: 300,
        //   command: ['CMD-SHELL', 'echo hi || exit 1'],
        // },
        environment: [
          { name: 'STEAMUSER', value: 'anonymous' },
          { name: 'STEAMBETA', value: 'false' },
          { name: 'MAXBACKUPS', value: '10' },
        ],
        mountPoints: [
          {
            containerPath: '/config',
            readOnly: false,
            sourceVolume: 'service-storage',
          },
        ],
        portMappings: [listener7777, listener15000, listener15777],
      },
    },
  },
});

// eslint-disable-next-line import/prefer-default-export
export const url = listener7777.endpoint.hostname;
